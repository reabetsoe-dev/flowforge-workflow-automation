from datetime import datetime

from pydantic import BaseModel


class MetricPoint(BaseModel):
    label: str
    value: int | float


class TimeSeriesPoint(BaseModel):
    month: str
    count: int


class BottleneckPoint(BaseModel):
    node_key: str
    node_title: str | None
    workflow_name: str | None
    average_wait_seconds: float
    sample_size: int


class ActivityItem(BaseModel):
    id: int
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: str | None
    description: str
    created_at: datetime


class ApprovalSnapshot(BaseModel):
    id: int
    workflow_instance_id: int
    reference_number: str | None
    workflow_name: str | None
    requester_name: str | None
    node_title: str | None
    status: str
    created_at: datetime


class RequestSnapshot(BaseModel):
    id: int
    reference_number: str
    workflow_name: str | None
    requester_name: str | None
    requester_department_name: str | None
    current_stage_title: str | None
    status: str
    started_at: datetime
    updated_at: datetime


class AnalyticsDashboard(BaseModel):
    total_executions: int
    completed: int
    rejected: int
    running: int
    completion_rate: float
    average_processing_seconds: float
    requests_per_month: list[TimeSeriesPoint]
    executions_by_workflow: list[MetricPoint]
    executions_by_department: list[MetricPoint]
    approval_outcomes: list[MetricPoint]
    completed_vs_rejected: list[MetricPoint]
    bottlenecks: list[BottleneckPoint]
    recent_activity: list[ActivityItem]
    pending_approvals: list[ApprovalSnapshot]
    recent_requests: list[RequestSnapshot]


class WorkflowAnalytics(BaseModel):
    workflow_id: int
    workflow_name: str
    total_executions: int
    completed: int
    rejected: int
    running: int
    completion_rate: float
    average_processing_seconds: float
    status_breakdown: list[MetricPoint]
    bottlenecks: list[BottleneckPoint]
