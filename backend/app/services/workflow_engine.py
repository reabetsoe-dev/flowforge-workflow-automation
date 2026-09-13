from collections.abc import Iterable
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.base import utc_now
from app.models.execution import (
    Approval,
    ApprovalStatus,
    Notification,
    Task,
    TaskStatus,
    WorkflowEvent,
    WorkflowInstance,
    WorkflowInstanceStatus,
)
from app.models.user import User, UserRole
from app.models.workflow import (
    Workflow,
    WorkflowEdge,
    WorkflowEdgeType,
    WorkflowNode,
    WorkflowNodeType,
    WorkflowStatus,
    WorkflowVersion,
)
from app.services.condition_evaluator import (
    ConditionEvaluationError,
    evaluate_condition,
)
from app.services.notification_service import create_internal_notification


class WorkflowExecutionError(Exception):
    pass


class WorkflowPermissionError(Exception):
    pass


class WorkflowEngine:
    def __init__(self, db: Session):
        self.db = db

    def start_workflow(
        self,
        workflow_id: int,
        started_by: User,
        submitted_data: dict[str, Any],
    ) -> WorkflowInstance:
        workflow = self._get_workflow(workflow_id)
        version = self._latest_published_version(workflow)
        if workflow.status != WorkflowStatus.PUBLISHED or version is None:
            raise WorkflowExecutionError("Workflow is not published.")

        start_node = self._find_start_node(version)
        reference_number = self._generate_reference_number(workflow)
        instance = WorkflowInstance(
            reference_number=reference_number,
            workflow_id=workflow.id,
            workflow_version_id=version.id,
            started_by=started_by.id,
            current_node_key=start_node.node_key,
            status=WorkflowInstanceStatus.RUNNING,
            submitted_data_json=submitted_data,
            started_at=utc_now(),
            updated_at=utc_now(),
        )
        self.db.add(instance)
        self.db.flush()

        self.process_current_node(instance)
        self.db.flush()
        return self._load_instance(instance.id)

    def process_current_node(self, instance: WorkflowInstance) -> None:
        version = self._load_version(instance.workflow_version_id)

        while instance.status == WorkflowInstanceStatus.RUNNING:
            node = self._node_by_key(version, instance.current_node_key)
            if node.node_type == WorkflowNodeType.START:
                self._record_completed_event(
                    instance,
                    node,
                    "START_COMPLETED",
                    f"{node.title} started the workflow.",
                )
                instance.current_node_key = self._next_node_key(version, node)
                instance.updated_at = utc_now()
                continue

            if node.node_type == WorkflowNodeType.FORM:
                self._validate_form_data(node, instance.submitted_data_json or {})
                self._record_completed_event(
                    instance,
                    node,
                    "FORM_SUBMITTED",
                    f"{node.title} was submitted.",
                )
                instance.current_node_key = self._next_node_key(version, node)
                instance.updated_at = utc_now()
                continue

            if node.node_type == WorkflowNodeType.APPROVAL:
                self._create_approval_pause(instance, node)
                return

            if node.node_type == WorkflowNodeType.CONDITION:
                branch_result = self._evaluate_condition_node(instance, version, node)
                self._record_completed_event(
                    instance,
                    node,
                    "CONDITION_EVALUATED",
                    f"{node.title} evaluated to {'TRUE' if branch_result else 'FALSE'}.",
                )
                instance.current_node_key = self._condition_next_node_key(
                    version,
                    node,
                    branch_result,
                )
                instance.updated_at = utc_now()
                continue

            if node.node_type == WorkflowNodeType.TASK:
                self._create_task_pause(instance, node)
                return

            if node.node_type == WorkflowNodeType.NOTIFICATION:
                created_count = self._create_notifications(instance, node)
                self._record_completed_event(
                    instance,
                    node,
                    "NOTIFICATION_CREATED",
                    f"{node.title} created {created_count} internal notification(s).",
                )
                instance.current_node_key = self._next_node_key(version, node)
                instance.updated_at = utc_now()
                continue

            if node.node_type == WorkflowNodeType.END:
                self._complete_instance(instance, node)
                return

            raise WorkflowExecutionError(
                f"{node.node_type.value} nodes are not supported by the execution engine yet."
            )

    def handle_approval(
        self,
        approval_id: int,
        actor: User,
        action: ApprovalStatus,
        comments: str | None = None,
    ) -> WorkflowInstance:
        approval = self._load_approval(approval_id)
        if approval.status != ApprovalStatus.PENDING:
            raise WorkflowExecutionError("Approval has already been completed.")
        if not self._can_respond_to_approval(approval, actor):
            raise WorkflowPermissionError("You are not authorized to respond to this approval.")
        node = self._node_by_key(approval.workflow_instance.workflow_version, approval.node_key)
        if (
            action == ApprovalStatus.REJECTED
            and (node.configuration_json or {}).get("comment_required_on_rejection")
            and not (comments or "").strip()
        ):
            raise WorkflowExecutionError("Comments are required when rejecting this approval.")

        now = utc_now()
        approval.status = action
        approval.comments = comments
        approval.responded_at = now

        instance = approval.workflow_instance
        instance.updated_at = now

        if action == ApprovalStatus.APPROVED:
            self._complete_waiting_event(
                instance,
                approval.node_key,
                "APPROVAL_WAITING",
                now,
            )
            self._record_completed_event(
                instance,
                node,
                "APPROVAL_APPROVED",
                f"{actor.full_name} approved {instance.reference_number}.",
                started_at=approval.created_at,
                completed_at=now,
            )
            instance.status = WorkflowInstanceStatus.RUNNING
            instance.current_node_key = self._next_node_key(instance.workflow_version, node)
            self.process_current_node(instance)
        elif action == ApprovalStatus.REJECTED:
            self._complete_waiting_event(instance, approval.node_key, "APPROVAL_WAITING", now)
            self._record_completed_event(
                instance,
                node,
                "APPROVAL_REJECTED",
                f"{actor.full_name} rejected {instance.reference_number}.",
                started_at=approval.created_at,
                completed_at=now,
            )
            instance.status = WorkflowInstanceStatus.REJECTED
            instance.completed_at = now
        elif action == ApprovalStatus.CHANGES_REQUESTED:
            self._complete_waiting_event(instance, approval.node_key, "APPROVAL_WAITING", now)
            self._record_completed_event(
                instance,
                node,
                "CHANGES_REQUESTED",
                f"{actor.full_name} requested changes for {instance.reference_number}.",
                started_at=approval.created_at,
                completed_at=now,
            )
            instance.status = WorkflowInstanceStatus.CHANGES_REQUESTED
        else:
            raise WorkflowExecutionError("Unsupported approval action.")

        self.db.flush()
        return self._load_instance(instance.id)

    def handle_task_start(self, task_id: int, actor: User) -> WorkflowInstance:
        task = self._load_task(task_id)
        if task.status != TaskStatus.PENDING:
            raise WorkflowExecutionError("Task is not pending.")
        if not self._can_work_on_task(task, actor):
            raise WorkflowPermissionError("You are not authorized to start this task.")

        now = utc_now()
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = now
        task.workflow_instance.updated_at = now
        self._record_task_event(
            task.workflow_instance,
            task,
            "TASK_STARTED",
            f"{actor.full_name} started {task.title}.",
            started_at=now,
            completed_at=now,
        )
        self.db.flush()
        return self._load_instance(task.workflow_instance_id)

    def handle_task_completion(
        self,
        task_id: int,
        actor: User,
        comments: str | None = None,
    ) -> WorkflowInstance:
        task = self._load_task(task_id)
        if task.status == TaskStatus.COMPLETED:
            raise WorkflowExecutionError("Task has already been completed.")
        if not self._can_work_on_task(task, actor):
            raise WorkflowPermissionError("You are not authorized to complete this task.")

        now = utc_now()
        task.status = TaskStatus.COMPLETED
        if task.started_at is None:
            task.started_at = now
        task.completed_at = now
        task.comments = (comments or "").strip() or None

        instance = task.workflow_instance
        node = self._node_by_key(instance.workflow_version, task.node_key)
        self._complete_waiting_event(instance, task.node_key, "TASK_WAITING", now)
        self._record_task_event(
            instance,
            task,
            "TASK_COMPLETED",
            f"{actor.full_name} completed {task.title}.",
            started_at=task.started_at,
            completed_at=now,
        )
        instance.status = WorkflowInstanceStatus.RUNNING
        instance.current_node_key = self._next_node_key(instance.workflow_version, node)
        instance.updated_at = now
        self.process_current_node(instance)
        self.db.flush()
        return self._load_instance(instance.id)

    def _get_workflow(self, workflow_id: int) -> Workflow:
        workflow = self.db.scalar(
            select(Workflow)
            .options(
                selectinload(Workflow.versions).selectinload(WorkflowVersion.nodes),
                selectinload(Workflow.versions).selectinload(WorkflowVersion.edges),
            )
            .where(Workflow.id == workflow_id)
        )
        if workflow is None:
            raise WorkflowExecutionError("Workflow not found.")
        return workflow

    def _load_version(self, version_id: int) -> WorkflowVersion:
        version = self.db.scalar(
            select(WorkflowVersion)
            .options(
                selectinload(WorkflowVersion.nodes),
                selectinload(WorkflowVersion.edges),
            )
            .where(WorkflowVersion.id == version_id)
        )
        if version is None:
            raise WorkflowExecutionError("Workflow version not found.")
        return version

    def _load_instance(self, instance_id: int) -> WorkflowInstance:
        instance = self.db.scalar(
            select(WorkflowInstance)
            .options(
                selectinload(WorkflowInstance.workflow),
                selectinload(WorkflowInstance.workflow_version).selectinload(WorkflowVersion.nodes),
                selectinload(WorkflowInstance.workflow_version).selectinload(WorkflowVersion.edges),
                selectinload(WorkflowInstance.starter).selectinload(User.department),
                selectinload(WorkflowInstance.approvals),
                selectinload(WorkflowInstance.tasks),
                selectinload(WorkflowInstance.events),
            )
            .where(WorkflowInstance.id == instance_id)
        )
        if instance is None:
            raise WorkflowExecutionError("Workflow instance not found.")
        return instance

    def _load_approval(self, approval_id: int) -> Approval:
        approval = self.db.scalar(
            select(Approval)
            .options(
                selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.workflow),
                selectinload(Approval.workflow_instance)
                .selectinload(WorkflowInstance.workflow_version)
                .selectinload(WorkflowVersion.nodes),
                selectinload(Approval.workflow_instance)
                .selectinload(WorkflowInstance.workflow_version)
                .selectinload(WorkflowVersion.edges),
                selectinload(Approval.workflow_instance)
                .selectinload(WorkflowInstance.starter)
                .selectinload(User.department),
                selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.approvals),
                selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.tasks),
                selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.events),
            )
            .where(Approval.id == approval_id)
        )
        if approval is None:
            raise WorkflowExecutionError("Approval not found.")
        return approval

    def _load_task(self, task_id: int) -> Task:
        task = self.db.scalar(
            select(Task)
            .options(
                selectinload(Task.workflow_instance).selectinload(WorkflowInstance.workflow),
                selectinload(Task.workflow_instance)
                .selectinload(WorkflowInstance.workflow_version)
                .selectinload(WorkflowVersion.nodes),
                selectinload(Task.workflow_instance)
                .selectinload(WorkflowInstance.workflow_version)
                .selectinload(WorkflowVersion.edges),
                selectinload(Task.workflow_instance)
                .selectinload(WorkflowInstance.starter)
                .selectinload(User.department),
                selectinload(Task.workflow_instance).selectinload(WorkflowInstance.approvals),
                selectinload(Task.workflow_instance).selectinload(WorkflowInstance.tasks),
                selectinload(Task.workflow_instance).selectinload(WorkflowInstance.events),
            )
            .where(Task.id == task_id)
        )
        if task is None:
            raise WorkflowExecutionError("Task not found.")
        return task

    def _latest_published_version(self, workflow: Workflow) -> WorkflowVersion | None:
        published = [version for version in workflow.versions if version.published_at is not None]
        if not published:
            return None
        return max(published, key=lambda version: version.version_number)

    def _find_start_node(self, version: WorkflowVersion) -> WorkflowNode:
        start_nodes = [node for node in version.nodes if node.node_type == WorkflowNodeType.START]
        if len(start_nodes) != 1:
            raise WorkflowExecutionError("Published workflow does not have exactly one Start node.")
        return start_nodes[0]

    def _node_by_key(self, version: WorkflowVersion, node_key: str | None) -> WorkflowNode:
        for node in version.nodes:
            if node.node_key == node_key:
                return node
        raise WorkflowExecutionError("Workflow node not found.")

    def _outgoing_edges(self, version: WorkflowVersion, node: WorkflowNode) -> Iterable[WorkflowEdge]:
        return [edge for edge in version.edges if edge.source_node_key == node.node_key]

    def _next_node_key(self, version: WorkflowVersion, node: WorkflowNode) -> str:
        outgoing = list(self._outgoing_edges(version, node))
        if not outgoing:
            raise WorkflowExecutionError(f"{node.title} has no outgoing path.")
        default_edge = next(
            (
                edge
                for edge in outgoing
                if edge.edge_type == WorkflowEdgeType.DEFAULT
                or not edge.label
                or edge.label == WorkflowEdgeType.DEFAULT.value
            ),
            None,
        )
        return (default_edge or outgoing[0]).target_node_key

    def _condition_next_node_key(
        self,
        version: WorkflowVersion,
        node: WorkflowNode,
        branch_result: bool,
    ) -> str:
        target_type = WorkflowEdgeType.TRUE if branch_result else WorkflowEdgeType.FALSE
        outgoing = list(self._outgoing_edges(version, node))
        for edge in outgoing:
            label = (edge.label or "").upper()
            if edge.edge_type == target_type or label == target_type.value:
                return edge.target_node_key
        raise WorkflowExecutionError(f"{node.title} is missing its {target_type.value} path.")

    def _validate_form_data(self, node: WorkflowNode, submitted_data: dict[str, Any]) -> None:
        fields = node.configuration_json.get("fields", []) if node.configuration_json else []
        if not isinstance(fields, list):
            raise WorkflowExecutionError(f"{node.title} has invalid form configuration.")

        missing = []
        for field in fields:
            if not isinstance(field, dict) or not field.get("required"):
                continue
            key = field.get("field_key")
            if key and submitted_data.get(key) in (None, ""):
                missing.append(field.get("label") or key)
        if missing:
            raise WorkflowExecutionError(
                f"{node.title} is missing required fields: {', '.join(missing)}."
            )

    def _create_approval_pause(self, instance: WorkflowInstance, node: WorkflowNode) -> None:
        existing_pending = next(
            (
                approval
                for approval in instance.approvals
                if approval.node_key == node.node_key and approval.status == ApprovalStatus.PENDING
            ),
            None,
        )
        if existing_pending is None:
            config = node.configuration_json or {}
            assigned_user_id = config.get("assigned_user_id")
            approval = Approval(
                workflow_instance_id=instance.id,
                node_key=node.node_key,
                assigned_user_id=int(assigned_user_id) if assigned_user_id else None,
                assigned_role=config.get("assigned_role"),
                status=ApprovalStatus.PENDING,
                created_at=utc_now(),
            )
            self.db.add(approval)
            instance.approvals.append(approval)

        now = utc_now()
        instance.current_node_key = node.node_key
        instance.status = WorkflowInstanceStatus.WAITING_FOR_APPROVAL
        instance.updated_at = now
        self.db.add(
            WorkflowEvent(
                workflow_instance_id=instance.id,
                node_key=node.node_key,
                event_type="APPROVAL_WAITING",
                description=f"{node.title} is waiting for approval.",
                started_at=now,
                created_at=now,
            )
        )
        self.db.flush()

    def _evaluate_condition_node(
        self,
        instance: WorkflowInstance,
        version: WorkflowVersion,
        node: WorkflowNode,
    ) -> bool:
        try:
            return evaluate_condition(node.configuration_json or {}, instance.submitted_data_json or {})
        except ConditionEvaluationError as exc:
            raise WorkflowExecutionError(str(exc)) from exc

    def _create_task_pause(self, instance: WorkflowInstance, node: WorkflowNode) -> None:
        existing_open_task = next(
            (
                task
                for task in instance.tasks
                if task.node_key == node.node_key and task.status != TaskStatus.COMPLETED
            ),
            None,
        )
        if existing_open_task is None:
            config = node.configuration_json or {}
            assigned_user_id = config.get("assigned_user_id")
            task = Task(
                workflow_instance_id=instance.id,
                node_key=node.node_key,
                title=str(config.get("title") or node.title),
                description=config.get("description"),
                assigned_user_id=int(assigned_user_id) if assigned_user_id else None,
                assigned_role=config.get("assigned_role"),
                status=TaskStatus.PENDING,
                due_date=None,
                created_at=utc_now(),
            )
            self.db.add(task)
            instance.tasks.append(task)

        now = utc_now()
        instance.current_node_key = node.node_key
        instance.status = WorkflowInstanceStatus.WAITING_FOR_TASK
        instance.updated_at = now
        self.db.add(
            WorkflowEvent(
                workflow_instance_id=instance.id,
                node_key=node.node_key,
                event_type="TASK_WAITING",
                description=f"{node.title} is waiting for task completion.",
                started_at=now,
                created_at=now,
            )
        )
        self.db.flush()

    def _create_notifications(self, instance: WorkflowInstance, node: WorkflowNode) -> int:
        config = node.configuration_json or {}
        title = str(config.get("title") or node.title)
        message_template = str(
            config.get("message")
            or f"{instance.reference_number} has advanced to {node.title}."
        )
        message = message_template.replace("{reference_number}", instance.reference_number)

        recipient_ids = self._notification_recipient_ids(instance, config)
        for user_id in recipient_ids:
            create_internal_notification(self.db, user_id, title, message)
        self.db.flush()
        return len(recipient_ids)

    def _notification_recipient_ids(
        self,
        instance: WorkflowInstance,
        config: dict[str, Any],
    ) -> list[int]:
        explicit_user = (
            config.get("recipient_user_id")
            or config.get("user_id")
            or config.get("assigned_user_id")
        )
        if explicit_user:
            return [int(explicit_user)]

        role = config.get("recipient_role") or config.get("assigned_role")
        if role:
            users = self.db.scalars(
                select(User).where(User.role == UserRole(role), User.active.is_(True))
            ).all()
            return [user.id for user in users]

        return [instance.started_by]

    def _complete_instance(self, instance: WorkflowInstance, node: WorkflowNode) -> None:
        result = (node.configuration_json or {}).get("result", WorkflowInstanceStatus.COMPLETED.value)
        now = utc_now()
        status = (
            WorkflowInstanceStatus.REJECTED
            if result == WorkflowInstanceStatus.REJECTED.value
            else WorkflowInstanceStatus.CANCELLED
            if result == WorkflowInstanceStatus.CANCELLED.value
            else WorkflowInstanceStatus.COMPLETED
        )
        self._record_completed_event(
            instance,
            node,
            "WORKFLOW_COMPLETED",
            f"{instance.reference_number} reached {node.title}.",
            started_at=now,
            completed_at=now,
        )
        instance.current_node_key = node.node_key
        instance.status = status
        instance.completed_at = now
        instance.updated_at = now

    def _record_completed_event(
        self,
        instance: WorkflowInstance,
        node: WorkflowNode,
        event_type: str,
        description: str,
        started_at=None,
        completed_at=None,
    ) -> None:
        now = utc_now()
        self.db.add(
            WorkflowEvent(
                workflow_instance_id=instance.id,
                node_key=node.node_key,
                event_type=event_type,
                description=description,
                started_at=started_at or now,
                completed_at=completed_at or now,
                created_at=now,
            )
        )

    def _record_task_event(
        self,
        instance: WorkflowInstance,
        task: Task,
        event_type: str,
        description: str,
        started_at=None,
        completed_at=None,
    ) -> None:
        now = utc_now()
        self.db.add(
            WorkflowEvent(
                workflow_instance_id=instance.id,
                node_key=task.node_key,
                event_type=event_type,
                description=description,
                started_at=started_at or now,
                completed_at=completed_at or now,
                created_at=now,
            )
        )

    def _complete_waiting_event(
        self,
        instance: WorkflowInstance,
        node_key: str,
        event_type: str,
        completed_at,
    ) -> None:
        event = self.db.scalar(
            select(WorkflowEvent)
            .where(
                WorkflowEvent.workflow_instance_id == instance.id,
                WorkflowEvent.node_key == node_key,
                WorkflowEvent.event_type == event_type,
                WorkflowEvent.completed_at.is_(None),
            )
            .order_by(WorkflowEvent.created_at.desc())
        )
        if event is not None:
            event.completed_at = completed_at

    def _can_respond_to_approval(self, approval: Approval, actor: User) -> bool:
        if actor.role == UserRole.ADMINISTRATOR:
            return True
        if approval.assigned_user_id and approval.assigned_user_id == actor.id:
            return True
        return approval.assigned_role == actor.role.value

    def _can_work_on_task(self, task: Task, actor: User) -> bool:
        if actor.role == UserRole.ADMINISTRATOR:
            return True
        if task.assigned_user_id and task.assigned_user_id == actor.id:
            return True
        return task.assigned_role == actor.role.value

    def _generate_reference_number(self, workflow: Workflow) -> str:
        prefix = self._reference_prefix(workflow)
        year = utc_now().year
        sequence = (
            self.db.scalar(
                select(func.count(WorkflowInstance.id)).where(
                    WorkflowInstance.reference_number.like(f"{prefix}-{year}-%")
                )
            )
            or 0
        ) + 1
        return f"{prefix}-{year}-{sequence:04d}"

    def _reference_prefix(self, workflow: Workflow) -> str:
        name = workflow.name.lower()
        category = workflow.category.lower()
        if "purchase" in name:
            return "PR"
        if "leave" in name:
            return "LR"
        if "access" in name or "information technology" in category:
            return "IT"
        if "equipment" in name:
            return "ER"

        words = [word for word in workflow.name.replace("/", " ").split() if word]
        letters = "".join(word[0] for word in words[:2]).upper()
        return letters or "WF"
