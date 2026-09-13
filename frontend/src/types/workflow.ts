export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type WorkflowNodeType =
  | "START"
  | "FORM"
  | "APPROVAL"
  | "CONDITION"
  | "TASK"
  | "NOTIFICATION"
  | "END";
export type WorkflowEdgeType = "DEFAULT" | "TRUE" | "FALSE";

export type WorkflowNode = {
  id: number;
  node_key: string;
  node_type: WorkflowNodeType;
  title: string;
  configuration_json: Record<string, unknown>;
  position_x: number;
  position_y: number;
};

export type WorkflowEdge = {
  id: number;
  source_node_key: string;
  target_node_key: string;
  edge_type: WorkflowEdgeType;
  label: string | null;
};

export type WorkflowVersion = {
  id: number;
  version_number: number;
  created_at: string;
  published_at: string | null;
  is_draft: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type WorkflowSummary = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  status: WorkflowStatus;
  created_by: number;
  created_by_name: string | null;
  version_count: number;
  latest_version_number: number | null;
  draft_version_number: number | null;
  published_version_number: number | null;
  node_count: number;
  edge_count: number;
  created_at: string;
  updated_at: string;
};

export type Workflow = WorkflowSummary & {
  latest_version: WorkflowVersion | null;
};

export type WorkflowCreateInput = {
  name: string;
  description: string | null;
  category: string;
};

export type WorkflowUpdateInput = Partial<WorkflowCreateInput>;

export type WorkflowValidation = {
  valid: boolean;
  errors: string[];
};
