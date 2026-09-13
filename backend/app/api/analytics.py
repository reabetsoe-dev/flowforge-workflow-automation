from collections import Counter, defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import require_roles
from app.api.serializers import _node_title
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.department import Department
from app.models.execution import Approval, WorkflowEvent, WorkflowInstance, WorkflowInstanceStatus
from app.models.user import User, UserRole
from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.analytics import (
    ActivityItem,
    AnalyticsDashboard,
    ApprovalSnapshot,
    BottleneckPoint,
    MetricPoint,
    RequestSnapshot,
    TimeSeriesPoint,
    WorkflowAnalytics,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

ANALYTICS_ROLES = (
    UserRole.ADMINISTRATOR,
    UserRole.WORKFLOW_DESIGNER,
    UserRole.AUDITOR,
)
ACTIVE_STATUSES = {
    WorkflowInstanceStatus.RUNNING,
    WorkflowInstanceStatus.WAITING_FOR_APPROVAL,
    WorkflowInstanceStatus.WAITING_FOR_TASK,
    WorkflowInstanceStatus.CHANGES_REQUESTED,
}
WAITING_EVENT_TYPES = {"APPROVAL_WAITING", "TASK_WAITING"}


def seconds_between(started_at: datetime | None, completed_at: datetime | None) -> float | None:
    if started_at is None or completed_at is None:
        return None
    return max(0.0, (completed_at - started_at).total_seconds())


def average(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def metric_points(counter: Counter[str], *, limit: int | None = None) -> list[MetricPoint]:
    items = counter.most_common(limit)
    return [MetricPoint(label=label, value=count) for label, count in items]


def request_snapshot(instance: WorkflowInstance) -> RequestSnapshot:
    return RequestSnapshot(
        id=instance.id,
        reference_number=instance.reference_number,
        workflow_name=instance.workflow.name if instance.workflow else None,
        requester_name=instance.starter.full_name if instance.starter else None,
        requester_department_name=(
            instance.starter.department.name
            if instance.starter and instance.starter.department
            else None
        ),
        current_stage_title=_node_title(instance.workflow_version, instance.current_node_key),
        status=instance.status.value,
        started_at=instance.started_at,
        updated_at=instance.updated_at,
    )


def approval_snapshot(approval: Approval) -> ApprovalSnapshot:
    instance = approval.workflow_instance
    return ApprovalSnapshot(
        id=approval.id,
        workflow_instance_id=approval.workflow_instance_id,
        reference_number=instance.reference_number if instance else None,
        workflow_name=instance.workflow.name if instance and instance.workflow else None,
        requester_name=instance.starter.full_name if instance and instance.starter else None,
        node_title=_node_title(instance.workflow_version if instance else None, approval.node_key),
        status=approval.status.value,
        created_at=approval.created_at,
    )


def activity_item(audit_log: AuditLog) -> ActivityItem:
    return ActivityItem(
        id=audit_log.id,
        actor_name=audit_log.user.full_name if audit_log.user else None,
        action=audit_log.action,
        entity_type=audit_log.entity_type,
        entity_id=audit_log.entity_id,
        description=audit_log.description,
        created_at=audit_log.created_at,
    )


def calculate_bottlenecks(
    events: list[WorkflowEvent],
    workflow_id: int | None = None,
) -> list[BottleneckPoint]:
    waits: dict[tuple[str, str | None, str | None], list[float]] = defaultdict(list)
    for event in events:
        if event.event_type not in WAITING_EVENT_TYPES:
            continue
        if workflow_id is not None and event.workflow_instance.workflow_id != workflow_id:
            continue
        wait_seconds = seconds_between(event.started_at, event.completed_at)
        if wait_seconds is None:
            continue
        key = (
            event.node_key or "unknown",
            _node_title(event.workflow_instance.workflow_version, event.node_key),
            event.workflow_instance.workflow.name if event.workflow_instance.workflow else None,
        )
        waits[key].append(wait_seconds)

    points = [
        BottleneckPoint(
            node_key=node_key,
            node_title=node_title,
            workflow_name=workflow_name,
            average_wait_seconds=average(values),
            sample_size=len(values),
        )
        for (node_key, node_title, workflow_name), values in waits.items()
    ]
    return sorted(points, key=lambda point: point.average_wait_seconds, reverse=True)[:8]


def load_instances(db: Session) -> list[WorkflowInstance]:
    return db.scalars(
        select(WorkflowInstance)
        .options(
            selectinload(WorkflowInstance.workflow),
            selectinload(WorkflowInstance.workflow_version).selectinload(WorkflowVersion.nodes),
            selectinload(WorkflowInstance.starter).selectinload(User.department),
        )
        .order_by(WorkflowInstance.started_at.desc())
    ).all()


@router.get("/dashboard", response_model=AnalyticsDashboard)
def dashboard_analytics(
    _: User = Depends(require_roles(*ANALYTICS_ROLES)),
    db: Session = Depends(get_db),
) -> AnalyticsDashboard:
    instances = load_instances(db)
    status_counts = Counter(instance.status for instance in instances)
    workflow_counts = Counter(instance.workflow.name if instance.workflow else "Unknown" for instance in instances)
    department_counts = Counter(
        instance.starter.department.name
        if instance.starter and instance.starter.department
        else "Unassigned"
        for instance in instances
    )
    month_counts = Counter(instance.started_at.strftime("%Y-%m") for instance in instances)

    completed = status_counts[WorkflowInstanceStatus.COMPLETED]
    rejected = status_counts[WorkflowInstanceStatus.REJECTED]
    running = sum(status_counts[status] for status in ACTIVE_STATUSES)
    total = len(instances)
    completion_rate = round((completed / total) * 100, 2) if total else 0.0
    processing_times = [
        value
        for value in (
            seconds_between(instance.started_at, instance.completed_at)
            for instance in instances
            if instance.status in {
                WorkflowInstanceStatus.COMPLETED,
                WorkflowInstanceStatus.REJECTED,
                WorkflowInstanceStatus.CANCELLED,
            }
        )
        if value is not None
    ]

    approvals = db.scalars(
        select(Approval)
        .options(
            selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.workflow),
            selectinload(Approval.workflow_instance)
            .selectinload(WorkflowInstance.workflow_version)
            .selectinload(WorkflowVersion.nodes),
            selectinload(Approval.workflow_instance).selectinload(WorkflowInstance.starter),
        )
        .order_by(Approval.created_at.desc())
    ).all()
    approval_counts = Counter(approval.status.value for approval in approvals)

    events = db.scalars(
        select(WorkflowEvent).options(
            selectinload(WorkflowEvent.workflow_instance).selectinload(WorkflowInstance.workflow),
            selectinload(WorkflowEvent.workflow_instance)
            .selectinload(WorkflowInstance.workflow_version)
            .selectinload(WorkflowVersion.nodes),
        )
    ).all()
    recent_activity = db.scalars(
        select(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(8)
    ).all()

    return AnalyticsDashboard(
        total_executions=total,
        completed=completed,
        rejected=rejected,
        running=running,
        completion_rate=completion_rate,
        average_processing_seconds=average(processing_times),
        requests_per_month=[
            TimeSeriesPoint(month=month, count=count)
            for month, count in sorted(month_counts.items())
        ],
        executions_by_workflow=metric_points(workflow_counts),
        executions_by_department=metric_points(department_counts),
        approval_outcomes=metric_points(approval_counts),
        completed_vs_rejected=[
            MetricPoint(label="Completed", value=completed),
            MetricPoint(label="Rejected", value=rejected),
        ],
        bottlenecks=calculate_bottlenecks(events),
        recent_activity=[activity_item(log) for log in recent_activity],
        pending_approvals=[
            approval_snapshot(approval)
            for approval in approvals
            if approval.status.value == "PENDING"
        ][:5],
        recent_requests=[request_snapshot(instance) for instance in instances[:6]],
    )


@router.get("/workflows/{workflow_id}", response_model=WorkflowAnalytics)
def workflow_analytics(
    workflow_id: int,
    _: User = Depends(require_roles(*ANALYTICS_ROLES)),
    db: Session = Depends(get_db),
) -> WorkflowAnalytics:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found.",
        )

    instances = [instance for instance in load_instances(db) if instance.workflow_id == workflow_id]
    status_counts = Counter(instance.status for instance in instances)
    completed = status_counts[WorkflowInstanceStatus.COMPLETED]
    rejected = status_counts[WorkflowInstanceStatus.REJECTED]
    running = sum(status_counts[status] for status in ACTIVE_STATUSES)
    total = len(instances)
    completion_rate = round((completed / total) * 100, 2) if total else 0.0
    processing_times = [
        value
        for value in (
            seconds_between(instance.started_at, instance.completed_at)
            for instance in instances
            if instance.completed_at is not None
        )
        if value is not None
    ]
    events = db.scalars(
        select(WorkflowEvent).options(
            selectinload(WorkflowEvent.workflow_instance).selectinload(WorkflowInstance.workflow),
            selectinload(WorkflowEvent.workflow_instance)
            .selectinload(WorkflowInstance.workflow_version)
            .selectinload(WorkflowVersion.nodes),
        )
    ).all()

    return WorkflowAnalytics(
        workflow_id=workflow.id,
        workflow_name=workflow.name,
        total_executions=total,
        completed=completed,
        rejected=rejected,
        running=running,
        completion_rate=completion_rate,
        average_processing_seconds=average(processing_times),
        status_breakdown=[
            MetricPoint(label=status.value, value=count)
            for status, count in status_counts.items()
        ],
        bottlenecks=calculate_bottlenecks(events, workflow_id=workflow_id),
    )
