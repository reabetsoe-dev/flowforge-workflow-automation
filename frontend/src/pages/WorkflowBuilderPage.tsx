import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Diamond,
  FileText,
  GitBranch,
  PlayCircle,
  Plus,
  Rocket,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";

import { EmptyState } from "../components/EmptyState";
import { NotificationDialog } from "../components/NotificationDialog";
import { api } from "../services/api";
import type {
  Workflow,
  WorkflowEdgeType,
  WorkflowNodeType,
  WorkflowValidation,
} from "../types/workflow";
import { getApiErrorMessage } from "../utils/errors";
import { roleOptions } from "../utils/roles";

type BuilderNodeData = {
  nodeType: WorkflowNodeType;
  title: string;
  config: Record<string, unknown>;
};

type BuilderEdgeData = {
  edgeType: WorkflowEdgeType;
};

type FormField = {
  label: string;
  field_key: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  minimum?: number | null;
  maximum?: number | null;
};

const nodePalette: Record<
  WorkflowNodeType,
  {
    label: string;
    description: string;
    icon: typeof PlayCircle;
    color: string;
    minimap: string;
  }
> = {
  START: {
    label: "Start",
    description: "One entry point",
    icon: PlayCircle,
    color: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100",
    minimap: "#14b8a6",
  },
  FORM: {
    label: "Form",
    description: "Collect request data",
    icon: FileText,
    color: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
    minimap: "#2563eb",
  },
  APPROVAL: {
    label: "Approval",
    description: "Pause for decision",
    icon: CheckCircle2,
    color: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    minimap: "#059669",
  },
  CONDITION: {
    label: "Condition",
    description: "Route by rule",
    icon: Diamond,
    color: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    minimap: "#d97706",
  },
  TASK: {
    label: "Task",
    description: "Create human work",
    icon: ClipboardCheck,
    color: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-100",
    minimap: "#0891b2",
  },
  NOTIFICATION: {
    label: "Notification",
    description: "Internal message",
    icon: Bell,
    color: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100",
    minimap: "#7c3aed",
  },
  END: {
    label: "End",
    description: "Finish instance",
    icon: Square,
    color: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
    minimap: "#64748b",
  },
};

const nodeTypes = {
  workflow: WorkflowNodeCard,
};

const operatorOptions = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
];

const fieldTypeOptions = [
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "email",
  "dropdown",
  "radio",
  "checkbox",
];

async function getWorkflow(id: number) {
  const response = await api.get<Workflow>(`/workflows/${id}`);
  return response.data;
}

function WorkflowNodeCard({ data, selected }: NodeProps<BuilderNodeData>) {
  const palette = nodePalette[data.nodeType];
  const Icon = palette.icon;

  return (
    <div
      className={`min-w-52 rounded-lg border-2 bg-white shadow-sm transition dark:bg-slate-900 ${
        selected ? "border-forge-600 ring-4 ring-forge-100 dark:ring-forge-950" : "border-slate-200 dark:border-slate-700"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-slate-500" />
      <div className={`rounded-t-md border-b px-3 py-2 ${palette.color}`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-normal">{palette.label}</span>
        </div>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{data.title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{palette.description}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-forge-600" />
    </div>
  );
}

function defaultConfigForType(nodeType: WorkflowNodeType): Record<string, unknown> {
  switch (nodeType) {
    case "START":
      return { description: "Workflow entry point." };
    case "FORM":
      return {
        fields: [
          {
            label: "Request Summary",
            field_key: "request_summary",
            type: "text",
            required: true,
          },
        ],
      };
    case "APPROVAL":
      return {
        assigned_role: "MANAGER",
        instructions: "Review the request details and decide the next step.",
        comment_required_on_rejection: true,
      };
    case "CONDITION":
      return { field: "amount", operator: "greater_than", value: 10000 };
    case "TASK":
      return {
        assigned_role: "MANAGER",
        title: "Complete task",
        description: "Complete the assigned workflow task.",
      };
    case "NOTIFICATION":
      return { title: "Workflow Update", message: "The request has moved to the next stage." };
    case "END":
      return { result: "COMPLETED" };
    default:
      return {};
  }
}

function apiToNodes(workflow: Workflow): Node<BuilderNodeData>[] {
  return (
    workflow.latest_version?.nodes.map((node) => ({
      id: node.node_key,
      type: "workflow",
      position: { x: node.position_x, y: node.position_y },
      data: {
        nodeType: node.node_type,
        title: node.title,
        config: node.configuration_json,
      },
    })) ?? []
  );
}

function apiToEdges(workflow: Workflow): Edge<BuilderEdgeData>[] {
  return (
    workflow.latest_version?.edges.map((edge) => ({
      id: `edge_${edge.id}_${edge.source_node_key}_${edge.target_node_key}`,
      source: edge.source_node_key,
      target: edge.target_node_key,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
      label: edge.edge_type === "DEFAULT" ? edge.label ?? undefined : edge.edge_type,
      data: { edgeType: edge.edge_type },
    })) ?? []
  );
}

function getFormFields(config: Record<string, unknown>): FormField[] {
  return Array.isArray(config.fields) ? (config.fields as FormField[]) : [];
}

function inputValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function parseRuleValue(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

export function WorkflowBuilderPage() {
  const params = useParams();
  const workflowId = Number(params.workflowId);
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BuilderEdgeData>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const workflowQuery = useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: () => getWorkflow(workflowId),
    enabled: Number.isFinite(workflowId),
  });

  const workflow = workflowQuery.data;
  const versionId = workflow?.latest_version?.id;
  const latestVersion = workflow?.latest_version;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const hasStartNode = nodes.some((node) => node.data.nodeType === "START");

  useEffect(() => {
    if (!workflow || !versionId) {
      return;
    }
    setNodes(apiToNodes(workflow));
    setEdges(apiToEdges(workflow));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setEdges, setNodes, versionId, workflow]);

  const saveWorkflow = useMutation({
    mutationFn: async () => {
      const payload = {
        nodes: nodes.map((node) => ({
          node_key: node.id,
          node_type: node.data.nodeType,
          title: node.data.title,
          configuration_json: node.data.config,
          position_x: node.position.x,
          position_y: node.position.y,
        })),
        edges: edges.map((edge) => {
          const edgeType = edge.data?.edgeType ?? "DEFAULT";
          return {
            source_node_key: edge.source,
            target_node_key: edge.target,
            edge_type: edgeType,
            label: edgeType === "DEFAULT" ? inputValue(edge.label) || null : edgeType,
          };
        }),
      };
      const response = await api.put<Workflow>(`/workflows/${workflowId}`, payload);
      return response.data;
    },
    onSuccess: (updatedWorkflow) => {
      queryClient.setQueryData(["workflow", workflowId], updatedWorkflow);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setNotice({ tone: "success", text: `${updatedWorkflow.name} was saved.` });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Workflow could not be saved.") });
    },
  });

  const validateWorkflow = useMutation({
    mutationFn: async () => {
      const response = await api.post<WorkflowValidation>(`/workflows/${workflowId}/validate`);
      return response.data;
    },
    onSuccess: (validation) => {
      setNotice({
        tone: validation.valid ? "success" : "error",
        text: validation.valid
          ? "Workflow passed validation."
          : `Validation errors: ${validation.errors.join(" ")}`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Validation failed.") });
    },
  });

  const publishWorkflow = useMutation({
    mutationFn: async () => {
      const response = await api.post<Workflow>(`/workflows/${workflowId}/publish`);
      return response.data;
    },
    onSuccess: (updatedWorkflow) => {
      queryClient.setQueryData(["workflow", workflowId], updatedWorkflow);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setNotice({ tone: "success", text: `${updatedWorkflow.name} was published.` });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Workflow could not be published.") });
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const existingBranches = edges
        .filter((edge) => edge.source === connection.source)
        .map((edge) => edge.data?.edgeType);
      let edgeType: WorkflowEdgeType = "DEFAULT";
      if (sourceNode?.data.nodeType === "CONDITION") {
        edgeType = existingBranches.includes("TRUE") ? "FALSE" : "TRUE";
      }

      const nextEdge: Edge<BuilderEdgeData> = {
        id: `edge_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
        label: edgeType === "DEFAULT" ? undefined : edgeType,
        data: { edgeType },
      };
      setEdges((currentEdges) => addEdge(nextEdge, currentEdges));
    },
    [edges, nodes, setEdges],
  );

  const addNode = useCallback(
    (nodeType: WorkflowNodeType) => {
      if (nodeType === "START" && hasStartNode) {
        setNotice({ tone: "error", text: "A workflow can only contain one Start node." });
        return;
      }

      const label = nodePalette[nodeType].label;
      const baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const existingKeys = new Set(nodes.map((node) => node.id));
      let index = nodes.length + 1;
      let nodeKey = `${baseKey}_${index}`;
      while (existingKeys.has(nodeKey)) {
        index += 1;
        nodeKey = `${baseKey}_${index}`;
      }

      const nextNode: Node<BuilderNodeData> = {
        id: nodeKey,
        type: "workflow",
        position: { x: 120 + nodes.length * 32, y: 120 + nodes.length * 20 },
        data: {
          nodeType,
          title: label,
          config: defaultConfigForType(nodeType),
        },
      };
      setNodes((currentNodes) => [...currentNodes, nextNode]);
      setSelectedNodeId(nextNode.id);
      setSelectedEdgeId(null);
    },
    [hasStartNode, nodes, setNodes],
  );

  function updateSelectedNode(next: Partial<BuilderNodeData>) {
    if (!selectedNode) {
      return;
    }
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNode.id ? { ...node, data: { ...node.data, ...next } } : node,
      ),
    );
  }

  function updateSelectedNodeConfig(nextConfig: Record<string, unknown>) {
    if (!selectedNode) {
      return;
    }
    updateSelectedNode({
      config: {
        ...selectedNode.data.config,
        ...nextConfig,
      },
    });
  }

  function updateSelectedEdge(edgeType: WorkflowEdgeType) {
    if (!selectedEdge) {
      return;
    }
    setEdges((currentEdges) =>
      currentEdges.map((edge) =>
        edge.id === selectedEdge.id
          ? {
              ...edge,
              label: edgeType === "DEFAULT" ? undefined : edgeType,
              data: { edgeType },
            }
          : edge,
      ),
    );
  }

  function deleteSelectedNode() {
    if (!selectedNode) {
      return;
    }
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id),
    );
    setSelectedNodeId(null);
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) {
      return;
    }
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeId(null);
  }

  const nodeCounts = useMemo(() => {
    return nodes.reduce<Record<string, number>>((counts, node) => {
      counts[node.data.nodeType] = (counts[node.data.nodeType] ?? 0) + 1;
      return counts;
    }, {});
  }, [nodes]);

  if (workflowQuery.isLoading) {
    return <div className="h-[720px] animate-pulse rounded-lg bg-white dark:bg-slate-900" />;
  }

  if (workflowQuery.error || !workflow) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Workflow unavailable"
        message="This workflow could not be loaded for editing."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/workflows"
                className="text-sm font-medium text-forge-700 hover:text-forge-800 dark:text-forge-300"
              >
                Workflows
              </Link>
              <span className="text-slate-400">/</span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Builder</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold text-slate-950 dark:text-white">
                {workflow.name}
              </h1>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                v{latestVersion?.version_number ?? "-"}
              </span>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                  latestVersion?.is_draft
                    ? "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
                    : "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900"
                }`}
              >
                {latestVersion?.is_draft ? "Draft" : "Published"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveWorkflow.mutate()}
              disabled={saveWorkflow.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {saveWorkflow.isPending ? "Saving" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => validateWorkflow.mutate()}
              disabled={validateWorkflow.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {validateWorkflow.isPending ? "Validating" : "Validate"}
            </button>
            <button
              type="button"
              onClick={() => publishWorkflow.mutate()}
              disabled={publishWorkflow.isPending || !workflow.draft_version_number}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              {publishWorkflow.isPending ? "Publishing" : "Publish"}
            </button>
          </div>
        </div>

        <div className="grid min-h-[720px] lg:grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Available Nodes
            </h2>
            <div className="mt-3 grid gap-2">
              {(Object.keys(nodePalette) as WorkflowNodeType[]).map((nodeType) => {
                const palette = nodePalette[nodeType];
                const Icon = palette.icon;
                const disabled = nodeType === "START" && hasStartNode;
                return (
                  <button
                    key={nodeType}
                    type="button"
                    onClick={() => addNode(nodeType)}
                    disabled={disabled}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-forge-300 hover:bg-forge-50 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-forge-700 dark:hover:bg-forge-950/30"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg border ${palette.color}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                        {palette.label}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {disabled ? "Already exists" : palette.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Nodes</span>
                <span className="font-semibold">{nodes.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Edges</span>
                <span className="font-semibold">{edges.length}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Approvals</span>
                <span className="font-semibold">{nodeCounts.APPROVAL ?? 0}</span>
              </div>
            </div>
          </aside>

          <section className="min-h-[620px] border-b border-slate-200 dark:border-slate-800 lg:border-b-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Canvas</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Drag nodes, connect handles, then save the graph.
                </p>
              </div>
              <div className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:block">
                React Flow
              </div>
            </div>
            <div className="h-[650px] bg-slate-50 dark:bg-slate-950">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) => nodePalette[(node.data as BuilderNodeData).nodeType].minimap}
                />
                <Controls />
              </ReactFlow>
            </div>
          </section>

          <aside className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Node Settings
            </h2>
            <div className="mt-3">
              {selectedNode ? (
                <NodeSettingsPanel
                  node={selectedNode}
                  onChange={updateSelectedNode}
                  onConfigChange={updateSelectedNodeConfig}
                  onDelete={deleteSelectedNode}
                />
              ) : selectedEdge ? (
                <EdgeSettingsPanel
                  edge={selectedEdge}
                  onChange={updateSelectedEdge}
                  onDelete={deleteSelectedEdge}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                  Select a node or edge to configure it.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 lg:hidden">
        Workflow editing is optimized for desktop and wide tablet screens.
      </section>
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

function NodeSettingsPanel({
  node,
  onChange,
  onConfigChange,
  onDelete,
}: {
  node: Node<BuilderNodeData>;
  onChange: (next: Partial<BuilderNodeData>) => void;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const palette = nodePalette[node.data.nodeType];
  const Icon = palette.icon;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg border ${palette.color}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{palette.label}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{node.id}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
          aria-label="Delete node"
          title="Delete node"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Title</span>
        <input
          value={node.data.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      {node.data.nodeType === "START" ? (
        <TextAreaSetting
          label="Description"
          value={inputValue(node.data.config.description)}
          onChange={(description) => onConfigChange({ description })}
        />
      ) : null}

      {node.data.nodeType === "FORM" ? (
        <FormSettings config={node.data.config} onConfigChange={onConfigChange} />
      ) : null}

      {node.data.nodeType === "APPROVAL" ? (
        <ApprovalSettings config={node.data.config} onConfigChange={onConfigChange} />
      ) : null}

      {node.data.nodeType === "CONDITION" ? (
        <ConditionSettings config={node.data.config} onConfigChange={onConfigChange} />
      ) : null}

      {node.data.nodeType === "TASK" ? (
        <TaskSettings config={node.data.config} onConfigChange={onConfigChange} />
      ) : null}

      {node.data.nodeType === "NOTIFICATION" ? (
        <NotificationSettings config={node.data.config} onConfigChange={onConfigChange} />
      ) : null}

      {node.data.nodeType === "END" ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Result</span>
          <select
            value={inputValue(node.data.config.result) || "COMPLETED"}
            onChange={(event) => onConfigChange({ result: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}

function EdgeSettingsPanel({
  edge,
  onChange,
  onDelete,
}: {
  edge: Edge<BuilderEdgeData>;
  onChange: (edgeType: WorkflowEdgeType) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">Edge</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {edge.source} to {edge.target}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
          aria-label="Delete edge"
          title="Delete edge"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Branch type</span>
        <select
          value={edge.data?.edgeType ?? "DEFAULT"}
          onChange={(event) => onChange(event.target.value as WorkflowEdgeType)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="DEFAULT">Default</option>
          <option value="TRUE">TRUE</option>
          <option value="FALSE">FALSE</option>
        </select>
      </label>
    </div>
  );
}

function TextAreaSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  );
}

function ApprovalSettings({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <RoleSelect
        label="Assigned role"
        value={inputValue(config.assigned_role) || "MANAGER"}
        onChange={(assignedRole) => onConfigChange({ assigned_role: assignedRole })}
      />
      <TextAreaSetting
        label="Instructions"
        value={inputValue(config.instructions)}
        onChange={(instructions) => onConfigChange({ instructions })}
      />
      <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
        <input
          checked={Boolean(config.comment_required_on_rejection)}
          onChange={(event) => onConfigChange({ comment_required_on_rejection: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-forge-600 focus:ring-forge-500"
          type="checkbox"
        />
        Require comments on rejection
      </label>
    </div>
  );
}

function ConditionSettings({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Field</span>
        <input
          value={inputValue(config.field)}
          onChange={(event) => onConfigChange({ field: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Operator</span>
        <select
          value={inputValue(config.operator) || "equals"}
          onChange={(event) => onConfigChange({ operator: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        >
          {operatorOptions.map((operator) => (
            <option key={operator} value={operator}>
              {operator.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Value</span>
        <input
          value={inputValue(config.value)}
          onChange={(event) => onConfigChange({ value: parseRuleValue(event.target.value) })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
    </div>
  );
}

function TaskSettings({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Task title</span>
        <input
          value={inputValue(config.title)}
          onChange={(event) => onConfigChange({ title: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <RoleSelect
        label="Assigned role"
        value={inputValue(config.assigned_role) || "MANAGER"}
        onChange={(assignedRole) => onConfigChange({ assigned_role: assignedRole })}
      />
      <TextAreaSetting
        label="Description"
        value={inputValue(config.description)}
        onChange={(description) => onConfigChange({ description })}
      />
    </div>
  );
}

function NotificationSettings({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Title</span>
        <input
          value={inputValue(config.title)}
          onChange={(event) => onConfigChange({ title: event.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <TextAreaSetting
        label="Message"
        value={inputValue(config.message)}
        onChange={(message) => onConfigChange({ message })}
      />
    </div>
  );
}

function FormSettings({
  config,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (nextConfig: Record<string, unknown>) => void;
}) {
  const fields = getFormFields(config);

  function updateField(index: number, next: Partial<FormField>) {
    onConfigChange({
      fields: fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...next } : field,
      ),
    });
  }

  function addField() {
    const nextIndex = fields.length + 1;
    onConfigChange({
      fields: [
        ...fields,
        {
          label: `Field ${nextIndex}`,
          field_key: `field_${nextIndex}`,
          type: "text",
          required: false,
        },
      ],
    });
  }

  function removeField(index: number) {
    onConfigChange({ fields: fields.filter((_, fieldIndex) => fieldIndex !== index) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Fields</p>
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No form fields configured.
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={`${field.field_key}_${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="grid gap-2">
                <input
                  value={field.label}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="Label"
                />
                <input
                  value={field.field_key}
                  onChange={(event) =>
                    updateField(index, {
                      field_key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="field_key"
                />
                <select
                  value={field.type}
                  onChange={(event) => updateField(index, { type: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
                >
                  {fieldTypeOptions.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {fieldType}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      checked={field.required}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-forge-600 focus:ring-forge-500"
                      type="checkbox"
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(index)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-200"
                    aria-label={`Remove ${field.label}`}
                    title="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900"
      >
        {roleOptions.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
    </label>
  );
}
