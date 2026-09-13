from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import instance_to_read, task_to_read
from app.core.database import get_db
from app.models.execution import Task, WorkflowInstance
from app.models.user import User, UserRole
from app.models.workflow import WorkflowVersion
from app.schemas.execution import TaskActionRequest, TaskRead, WorkflowInstanceRead
from app.services.audit_service import record_audit_log
from app.services.workflow_engine import (
    WorkflowEngine,
    WorkflowExecutionError,
    WorkflowPermissionError,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

VIEW_ALL_TASK_ROLES = {
    UserRole.ADMINISTRATOR,
    UserRole.WORKFLOW_DESIGNER,
    UserRole.AUDITOR,
}


def task_query():
    return (
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
        .order_by(Task.created_at.desc())
    )


def can_view_task(task: Task, user: User) -> bool:
    if user.role in VIEW_ALL_TASK_ROLES:
        return True
    return task.assigned_user_id == user.id or task.assigned_role == user.role.value


@router.get("", response_model=list[TaskRead])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskRead]:
    tasks = db.scalars(task_query()).all()
    return [task_to_read(task) for task in tasks if can_view_task(task, current_user)]


def perform_task_action(
    task_id: int,
    payload: TaskActionRequest,
    current_user: User,
    db: Session,
    action: str,
) -> WorkflowInstanceRead:
    engine = WorkflowEngine(db)
    try:
        if action == "start":
            instance = engine.handle_task_start(task_id, current_user)
            audit_action = "TASK_STARTED"
        else:
            instance = engine.handle_task_completion(
                task_id,
                current_user,
                comments=payload.comments,
            )
            audit_action = "TASK_COMPLETED"
        record_audit_log(
            db,
            current_user,
            audit_action,
            "Task",
            task_id,
            f"{current_user.full_name} {audit_action.lower().replace('_', ' ')} for {instance.reference_number}.",
        )
        if instance.status.value in {"COMPLETED", "REJECTED", "CANCELLED"}:
            record_audit_log(
                db,
                current_user,
                f"WORKFLOW_{instance.status.value}",
                "WorkflowInstance",
                instance.reference_number,
                f"{instance.reference_number} reached {instance.status.value}.",
            )
        db.commit()
        return instance_to_read(instance)
    except WorkflowPermissionError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except WorkflowExecutionError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/{task_id}/start", response_model=WorkflowInstanceRead)
def start_task(
    task_id: int,
    payload: TaskActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    return perform_task_action(task_id, payload, current_user, db, "start")


@router.post("/{task_id}/complete", response_model=WorkflowInstanceRead)
def complete_task(
    task_id: int,
    payload: TaskActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    return perform_task_action(task_id, payload, current_user, db, "complete")
