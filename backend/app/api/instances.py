from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import instance_to_read
from app.core.database import get_db
from app.models.execution import WorkflowInstance
from app.models.user import User, UserRole
from app.models.workflow import WorkflowVersion
from app.schemas.execution import WorkflowInstanceRead

router = APIRouter(prefix="/instances", tags=["Workflow Instances"])

VIEW_ALL_ROLES = {
    UserRole.ADMINISTRATOR,
    UserRole.WORKFLOW_DESIGNER,
    UserRole.AUDITOR,
}


def instance_query():
    return (
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
        .order_by(WorkflowInstance.started_at.desc())
    )


def can_view_instance(instance: WorkflowInstance, user: User) -> bool:
    if user.role in VIEW_ALL_ROLES:
        return True
    if instance.started_by == user.id:
        return True
    return any(
        approval.assigned_user_id == user.id or approval.assigned_role == user.role.value
        for approval in instance.approvals
    ) or any(
        task.assigned_user_id == user.id or task.assigned_role == user.role.value
        for task in instance.tasks
    )


@router.get("", response_model=list[WorkflowInstanceRead])
def list_instances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkflowInstanceRead]:
    instances = db.scalars(instance_query()).all()
    visible_instances = [
        instance for instance in instances if can_view_instance(instance, current_user)
    ]
    return [instance_to_read(instance) for instance in visible_instances]


@router.get("/{instance_id}", response_model=WorkflowInstanceRead)
def get_instance(
    instance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    instance = db.scalar(instance_query().where(WorkflowInstance.id == instance_id))
    if instance is None or not can_view_instance(instance, current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow instance not found.",
        )
    return instance_to_read(instance)
