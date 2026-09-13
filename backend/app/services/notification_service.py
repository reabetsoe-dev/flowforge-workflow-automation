from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.models.execution import Notification


def create_internal_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        is_read=False,
        created_at=utc_now(),
    )
    db.add(notification)
    return notification
