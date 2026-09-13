from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.execution import ApprovalStatus, TaskStatus, WorkflowInstanceStatus


class StartWorkflowRequest(BaseModel):
    submitted_data_json: dict[str, Any] = Field(default_factory=dict)


class ApprovalActionRequest(BaseModel):
    comments: str | None = None


class TaskActionRequest(BaseModel):
    comments: str | None = None


class ApprovalRead(BaseModel):
    id: int
    workflow_instance_id: int
    reference_number: str | None = None
    workflow_name: str | None = None
    requester_name: str | None = None
    requester_department_name: str | None = None
    node_key: str
    node_title: str | None = None
    assigned_user_id: int | None
    assigned_role: str | None
    status: ApprovalStatus
    comments: str | None
    created_at: datetime
    responded_at: datetime | None


class TaskRead(BaseModel):
    id: int
    workflow_instance_id: int
    reference_number: str | None = None
    workflow_name: str | None = None
    requester_name: str | None = None
    requester_department_name: str | None = None
    node_key: str
    node_title: str | None = None
    title: str
    description: str | None
    comments: str | None
    assigned_user_id: int | None
    assigned_role: str | None
    status: TaskStatus
    due_date: datetime | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class NotificationRead(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime


class WorkflowEventRead(BaseModel):
    id: int
    workflow_instance_id: int
    node_key: str | None
    node_title: str | None = None
    event_type: str
    description: str
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class WorkflowInstanceRead(BaseModel):
    id: int
    reference_number: str
    workflow_id: int
    workflow_name: str | None = None
    workflow_version_id: int
    workflow_version_number: int | None = None
    started_by: int
    requester_name: str | None = None
    current_node_key: str | None
    current_stage_title: str | None = None
    status: WorkflowInstanceStatus
    submitted_data_json: dict[str, Any]
    started_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    approvals: list[ApprovalRead]
    tasks: list[TaskRead]
    events: list[WorkflowEventRead]
