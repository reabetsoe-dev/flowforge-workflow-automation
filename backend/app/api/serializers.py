from app.models.execution import Approval, Notification, Task, WorkflowEvent, WorkflowInstance
from app.models.workflow import WorkflowVersion
from app.schemas.execution import (
    ApprovalRead,
    NotificationRead,
    TaskRead,
    WorkflowEventRead,
    WorkflowInstanceRead,
)


def _node_title(version: WorkflowVersion | None, node_key: str | None) -> str | None:
    if version is None or node_key is None:
        return None
    for node in version.nodes:
        if node.node_key == node_key:
            return node.title
    return None


def approval_to_read(approval: Approval) -> ApprovalRead:
    instance = approval.workflow_instance
    version = instance.workflow_version if instance else None
    starter = instance.starter if instance else None
    return ApprovalRead(
        id=approval.id,
        workflow_instance_id=approval.workflow_instance_id,
        reference_number=instance.reference_number if instance else None,
        workflow_name=instance.workflow.name if instance and instance.workflow else None,
        requester_name=starter.full_name if starter else None,
        requester_department_name=starter.department.name if starter and starter.department else None,
        node_key=approval.node_key,
        node_title=_node_title(version, approval.node_key),
        assigned_user_id=approval.assigned_user_id,
        assigned_role=approval.assigned_role,
        status=approval.status,
        comments=approval.comments,
        created_at=approval.created_at,
        responded_at=approval.responded_at,
    )


def event_to_read(event: WorkflowEvent, version: WorkflowVersion | None) -> WorkflowEventRead:
    return WorkflowEventRead(
        id=event.id,
        workflow_instance_id=event.workflow_instance_id,
        node_key=event.node_key,
        node_title=_node_title(version, event.node_key),
        event_type=event.event_type,
        description=event.description,
        started_at=event.started_at,
        completed_at=event.completed_at,
        created_at=event.created_at,
    )


def task_to_read(task: Task) -> TaskRead:
    instance = task.workflow_instance
    version = instance.workflow_version if instance else None
    starter = instance.starter if instance else None
    return TaskRead(
        id=task.id,
        workflow_instance_id=task.workflow_instance_id,
        reference_number=instance.reference_number if instance else None,
        workflow_name=instance.workflow.name if instance and instance.workflow else None,
        requester_name=starter.full_name if starter else None,
        requester_department_name=starter.department.name if starter and starter.department else None,
        node_key=task.node_key,
        node_title=_node_title(version, task.node_key),
        title=task.title,
        description=task.description,
        comments=task.comments,
        assigned_user_id=task.assigned_user_id,
        assigned_role=task.assigned_role,
        status=task.status,
        due_date=task.due_date,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


def notification_to_read(notification: Notification) -> NotificationRead:
    return NotificationRead(
        id=notification.id,
        user_id=notification.user_id,
        title=notification.title,
        message=notification.message,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


def instance_to_read(instance: WorkflowInstance) -> WorkflowInstanceRead:
    version = instance.workflow_version
    return WorkflowInstanceRead(
        id=instance.id,
        reference_number=instance.reference_number,
        workflow_id=instance.workflow_id,
        workflow_name=instance.workflow.name if instance.workflow else None,
        workflow_version_id=instance.workflow_version_id,
        workflow_version_number=version.version_number if version else None,
        started_by=instance.started_by,
        requester_name=instance.starter.full_name if instance.starter else None,
        current_node_key=instance.current_node_key,
        current_stage_title=_node_title(version, instance.current_node_key),
        status=instance.status,
        submitted_data_json=instance.submitted_data_json or {},
        started_at=instance.started_at,
        updated_at=instance.updated_at,
        completed_at=instance.completed_at,
        approvals=[approval_to_read(approval) for approval in instance.approvals],
        tasks=[task_to_read(task) for task in instance.tasks],
        events=[event_to_read(event, version) for event in instance.events],
    )
