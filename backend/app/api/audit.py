from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


def audit_log_to_read(audit_log: AuditLog) -> AuditLogRead:
    return AuditLogRead(
        id=audit_log.id,
        user_id=audit_log.user_id,
        user_name=audit_log.user.full_name if audit_log.user else None,
        user_email=audit_log.user.email if audit_log.user else None,
        action=audit_log.action,
        entity_type=audit_log.entity_type,
        entity_id=audit_log.entity_id,
        description=audit_log.description,
        created_at=audit_log.created_at,
    )


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    _: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.AUDITOR)),
    db: Session = Depends(get_db),
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    search: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(100, ge=1, le=250),
    offset: int = Query(0, ge=0),
) -> list[AuditLogRead]:
    query = select(AuditLog).options(joinedload(AuditLog.user))

    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(AuditLog.action).like(term),
                func.lower(AuditLog.entity_type).like(term),
                func.lower(AuditLog.entity_id).like(term),
                func.lower(AuditLog.description).like(term),
            )
        )

    audit_logs = db.scalars(
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return [audit_log_to_read(audit_log) for audit_log in audit_logs]
