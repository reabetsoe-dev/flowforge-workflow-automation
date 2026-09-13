export type RoleCount = {
  role: string;
  count: number;
};

export type DashboardSummary = {
  active_users: number;
  departments: number;
  demo_accounts: number;
  published_workflows: number;
  active_requests: number;
  pending_approvals: number;
  open_tasks: number;
  completed_requests: number;
  rejected_requests: number;
  role_counts: RoleCount[];
};
