from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def record_audit_log(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    description: str,
) -> AuditLog:
    audit_log = AuditLog(
        user_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        description=description,
    )
    db.add(audit_log)
    return audit_log
