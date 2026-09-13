export type MetricPoint = {
  label: string;
  value: number;
};

export type TimeSeriesPoint = {
  month: string;
  count: number;
};

export type BottleneckPoint = {
  node_key: string;
  node_title: string | null;
  workflow_name: string | null;
  average_wait_seconds: number;
  sample_size: number;
};

export type ActivityItem = {
  id: number;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  created_at: string;
};

export type ApprovalSnapshot = {
  id: number;
  workflow_instance_id: number;
  reference_number: string | null;
  workflow_name: string | null;
  requester_name: string | null;
  node_title: string | null;
  status: string;
  created_at: string;
};

export type RequestSnapshot = {
  id: number;
  reference_number: string;
  workflow_name: string | null;
  requester_name: string | null;
  requester_department_name: string | null;
  current_stage_title: string | null;
  status: string;
  started_at: string;
  updated_at: string;
};

export type AnalyticsDashboard = {
  total_executions: number;
  completed: number;
  rejected: number;
  running: number;
  completion_rate: number;
  average_processing_seconds: number;
  requests_per_month: TimeSeriesPoint[];
  executions_by_workflow: MetricPoint[];
  executions_by_department: MetricPoint[];
  approval_outcomes: MetricPoint[];
  completed_vs_rejected: MetricPoint[];
  bottlenecks: BottleneckPoint[];
  recent_activity: ActivityItem[];
  pending_approvals: ApprovalSnapshot[];
  recent_requests: RequestSnapshot[];
};
