export type WorkflowInstanceStatus =
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "WAITING_FOR_TASK"
  | "CHANGES_REQUESTED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";

export type Approval = {
  id: number;
  workflow_instance_id: number;
  reference_number: string | null;
  workflow_name: string | null;
  requester_name: string | null;
  requester_department_name: string | null;
  node_key: string;
  node_title: string | null;
  assigned_user_id: number | null;
  assigned_role: string | null;
  status: ApprovalStatus;
  comments: string | null;
  created_at: string;
  responded_at: string | null;
};

export type Task = {
  id: number;
  workflow_instance_id: number;
  reference_number: string | null;
  workflow_name: string | null;
  requester_name: string | null;
  requester_department_name: string | null;
  node_key: string;
  node_title: string | null;
  title: string;
  description: string | null;
  comments: string | null;
  assigned_user_id: number | null;
  assigned_role: string | null;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type WorkflowEvent = {
  id: number;
  workflow_instance_id: number;
  node_key: string | null;
  node_title: string | null;
  event_type: string;
  description: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Notification = {
  id: number;
  user_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type WorkflowInstance = {
  id: number;
  reference_number: string;
  workflow_id: number;
  workflow_name: string | null;
  workflow_version_id: number;
  workflow_version_number: number | null;
  started_by: number;
  requester_name: string | null;
  current_node_key: string | null;
  current_stage_title: string | null;
  status: WorkflowInstanceStatus;
  submitted_data_json: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  approvals: Approval[];
  tasks: Task[];
  events: WorkflowEvent[];
};

export type StartWorkflowInput = {
  submitted_data_json: Record<string, unknown>;
};
