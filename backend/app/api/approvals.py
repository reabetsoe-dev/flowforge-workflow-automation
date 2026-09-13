from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import approval_to_read, instance_to_read
from app.core.database import get_db
from app.models.execution import Approval, ApprovalStatus, WorkflowInstance
from app.models.user import User, UserRole
from app.models.workflow import WorkflowVersion
from app.schemas.execution import ApprovalActionRequest, ApprovalRead, WorkflowInstanceRead
from app.services.audit_service import record_audit_log
from app.services.workflow_engine import (
    WorkflowEngine,
    WorkflowExecutionError,
    WorkflowPermissionError,
)

router = APIRouter(prefix="/approvals", tags=["Approvals"])

VIEW_ALL_APPROVAL_ROLES = {
    UserRole.ADMINISTRATOR,
    UserRole.WORKFLOW_DESIGNER,
    UserRole.AUDITOR,
}
APPROVAL_AUDIT_ACTIONS = {
    ApprovalStatus.APPROVED: "APPROVAL_APPROVED",
    ApprovalStatus.REJECTED: "APPROVAL_REJECTED",
    ApprovalStatus.CHANGES_REQUESTED: "CHANGES_REQUESTED",
}


def approval_query():
    return (
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
        .order_by(Approval.created_at.desc())
    )


def can_view_approval(approval: Approval, user: User) -> bool:
    if user.role in VIEW_ALL_APPROVAL_ROLES:
        return True
    return approval.assigned_user_id == user.id or approval.assigned_role == user.role.value


@router.get("", response_model=list[ApprovalRead])
def list_approvals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApprovalRead]:
    approvals = db.scalars(approval_query()).all()
    return [
        approval_to_read(approval)
        for approval in approvals
        if can_view_approval(approval, current_user)
    ]


def respond_to_approval(
    approval_id: int,
    payload: ApprovalActionRequest,
    current_user: User,
    db: Session,
    action: ApprovalStatus,
) -> WorkflowInstanceRead:
    engine = WorkflowEngine(db)
    try:
        instance = engine.handle_approval(
            approval_id=approval_id,
            actor=current_user,
            action=action,
            comments=payload.comments,
        )
        record_audit_log(
            db,
            current_user,
            APPROVAL_AUDIT_ACTIONS[action],
            "Approval",
            approval_id,
            f"{current_user.full_name} responded to {instance.reference_number} with {action.value}.",
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


@router.post("/{approval_id}/approve", response_model=WorkflowInstanceRead)
def approve(
    approval_id: int,
    payload: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    return respond_to_approval(
        approval_id,
        payload,
        current_user,
        db,
        ApprovalStatus.APPROVED,
    )


@router.post("/{approval_id}/reject", response_model=WorkflowInstanceRead)
def reject(
    approval_id: int,
    payload: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    return respond_to_approval(
        approval_id,
        payload,
        current_user,
        db,
        ApprovalStatus.REJECTED,
    )


@router.post("/{approval_id}/request-changes", response_model=WorkflowInstanceRead)
def request_changes(
    approval_id: int,
    payload: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkflowInstanceRead:
    return respond_to_approval(
        approval_id,
        payload,
        current_user,
        db,
        ApprovalStatus.CHANGES_REQUESTED,
    )
