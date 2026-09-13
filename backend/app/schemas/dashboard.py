from pydantic import BaseModel


class RoleCount(BaseModel):
    role: str
    count: int


class DashboardSummary(BaseModel):
    active_users: int
    departments: int
    demo_accounts: int
    published_workflows: int
    active_requests: int
    pending_approvals: int
    open_tasks: int
    completed_requests: int
    rejected_requests: int
    role_counts: list[RoleCount]
