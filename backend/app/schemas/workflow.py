from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.workflow import WorkflowEdgeType, WorkflowNodeType, WorkflowStatus


class WorkflowNodePayload(BaseModel):
    node_key: str = Field(min_length=1, max_length=80)
    node_type: WorkflowNodeType
    title: str = Field(min_length=1, max_length=160)
    configuration_json: dict[str, Any] = Field(default_factory=dict)
    position_x: float = 0
    position_y: float = 0


class WorkflowEdgePayload(BaseModel):
    source_node_key: str = Field(min_length=1, max_length=80)
    target_node_key: str = Field(min_length=1, max_length=80)
    edge_type: WorkflowEdgeType = WorkflowEdgeType.DEFAULT
    label: str | None = Field(default=None, max_length=80)


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    category: str = Field(min_length=2, max_length=80)
    nodes: list[WorkflowNodePayload] | None = None
    edges: list[WorkflowEdgePayload] | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    category: str | None = Field(default=None, min_length=2, max_length=80)
    nodes: list[WorkflowNodePayload] | None = None
    edges: list[WorkflowEdgePayload] | None = None


class WorkflowNodeRead(WorkflowNodePayload):
    model_config = ConfigDict(from_attributes=True)

    id: int


class WorkflowEdgeRead(WorkflowEdgePayload):
    model_config = ConfigDict(from_attributes=True)

    id: int


class WorkflowVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_number: int
    created_at: datetime
    published_at: datetime | None
    is_draft: bool
    nodes: list[WorkflowNodeRead]
    edges: list[WorkflowEdgeRead]


class WorkflowSummary(BaseModel):
    id: int
    name: str
    description: str | None
    category: str
    status: WorkflowStatus
    created_by: int
    created_by_name: str | None = None
    version_count: int
    latest_version_number: int | None
    draft_version_number: int | None
    published_version_number: int | None
    node_count: int
    edge_count: int
    created_at: datetime
    updated_at: datetime


class WorkflowRead(WorkflowSummary):
    latest_version: WorkflowVersionRead | None


class WorkflowValidationResponse(BaseModel):
    valid: bool
    errors: list[str]
