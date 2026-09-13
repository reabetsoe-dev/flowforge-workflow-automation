from datetime import datetime

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    user_id: int | None
    user_name: str | None = None
    user_email: str | None = None
    action: str
    entity_type: str
    entity_id: str | None
    description: str
    created_at: datetime
