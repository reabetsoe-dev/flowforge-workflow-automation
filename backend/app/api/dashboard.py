from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.department import Department
from app.models.execution import (
    Approval,
    ApprovalStatus,
    Task,
    TaskStatus,
    WorkflowInstance,
    WorkflowInstanceStatus,
)
from app.models.user import User, UserRole
from app.models.workflow import Workflow, WorkflowStatus
from app.schemas.dashboard import DashboardSummary, RoleCount

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    active_users = db.scalar(select(func.count(User.id)).where(User.active.is_(True))) or 0
    departments = db.scalar(select(func.count(Department.id))) or 0
    published_workflows = (
        db.scalar(select(func.count(Workflow.id)).where(Workflow.status == WorkflowStatus.PUBLISHED))
        or 0
    )
    active_requests = (
        db.scalar(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.status.in_(
                    [
                        WorkflowInstanceStatus.RUNNING,
                        WorkflowInstanceStatus.WAITING_FOR_APPROVAL,
                        WorkflowInstanceStatus.WAITING_FOR_TASK,
                        WorkflowInstanceStatus.CHANGES_REQUESTED,
                    ]
                )
            )
        )
        or 0
    )
    pending_approvals = (
        db.scalar(
            select(func.count(Approval.id)).where(Approval.status == ApprovalStatus.PENDING)
        )
        or 0
    )
    open_tasks = (
        db.scalar(
            select(func.count(Task.id)).where(
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
            )
        )
        or 0
    )
    completed_requests = (
        db.scalar(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.status == WorkflowInstanceStatus.COMPLETED
            )
        )
        or 0
    )
    rejected_requests = (
        db.scalar(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.status == WorkflowInstanceStatus.REJECTED
            )
        )
        or 0
    )
    role_rows = db.execute(
        select(User.role, func.count(User.id))
        .where(User.active.is_(True))
        .group_by(User.role)
        .order_by(User.role)
    ).all()

    role_counts = [
        RoleCount(role=role.value if isinstance(role, UserRole) else str(role), count=count)
        for role, count in role_rows
    ]

    return DashboardSummary(
        active_users=active_users,
        departments=departments,
        demo_accounts=5,
        published_workflows=published_workflows,
        active_requests=active_requests,
        pending_approvals=pending_approvals,
        open_tasks=open_tasks,
        completed_requests=completed_requests,
        rejected_requests=rejected_requests,
        role_counts=role_counts,
    )
