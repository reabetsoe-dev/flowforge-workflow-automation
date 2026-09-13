import {
  CheckCircle2,
  Edit3,
  Eye,
  GitBranch,
  Plus,
  Rocket,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { NotificationDialog } from "../components/NotificationDialog";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import type {
  Workflow,
  WorkflowCreateInput,
  WorkflowStatus,
  WorkflowSummary,
  WorkflowUpdateInput,
  WorkflowValidation,
} from "../types/workflow";
import { getApiErrorMessage } from "../utils/errors";

type WorkflowFormState = {
  id?: number;
  name: string;
  category: string;
  description: string;
};

type DialogState =
  | { mode: "create"; form: WorkflowFormState }
  | { mode: "edit"; form: WorkflowFormState };

const emptyWorkflowForm: WorkflowFormState = {
  name: "",
  category: "Administration",
  description: "",
};

const statusStyles: Record<WorkflowStatus, string> = {
  DRAFT: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  PUBLISHED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

async function getWorkflows() {
  const response = await api.get<WorkflowSummary[]>("/workflows");
  return response.data;
}

async function getWorkflow(id: number) {
  const response = await api.get<Workflow>(`/workflows/${id}`);
  return response.data;
}

function workflowToForm(workflow: WorkflowSummary): WorkflowFormState {
  return {
    id: workflow.id,
    name: workflow.name,
    category: workflow.category,
    description: workflow.description ?? "",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not published";
  }
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function WorkflowsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "ALL">("ALL");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const canManage = user?.role === "ADMINISTRATOR" || user?.role === "WORKFLOW_DESIGNER";

  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: getWorkflows });
  const selectedWorkflowQuery = useQuery({
    queryKey: ["workflow", selectedWorkflowId],
    queryFn: () => getWorkflow(selectedWorkflowId as number),
    enabled: selectedWorkflowId !== null,
  });

  const workflows = workflowsQuery.data ?? [];
  const filteredWorkflows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workflows.filter((workflow) => {
      const matchesSearch =
        !term ||
        workflow.name.toLowerCase().includes(term) ||
        workflow.category.toLowerCase().includes(term) ||
        (workflow.description ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "ALL" || workflow.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, workflows]);

  const saveWorkflow = useMutation({
    mutationFn: async (state: DialogState) => {
      const description = state.form.description.trim() || null;
      if (state.mode === "create") {
        const payload: WorkflowCreateInput = {
          name: state.form.name.trim(),
          category: state.form.category.trim(),
          description,
        };
        const response = await api.post<Workflow>("/workflows", payload);
        return response.data;
      }

      const payload: WorkflowUpdateInput = {
        name: state.form.name.trim(),
        category: state.form.category.trim(),
        description,
      };
      const response = await api.put<Workflow>(`/workflows/${state.form.id}`, payload);
      return response.data;
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDialog(null);
      setFormError("");
      setNotice({ tone: "success", text: `${workflow.name} was saved.` });
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Workflow could not be saved."));
    },
  });

  const validateWorkflow = useMutation({
    mutationFn: async (workflow: WorkflowSummary) => {
      const response = await api.post<WorkflowValidation>(`/workflows/${workflow.id}/validate`);
      return { workflow, validation: response.data };
    },
    onSuccess: ({ workflow, validation }) => {
      setNotice({
        tone: validation.valid ? "success" : "error",
        text: validation.valid
          ? `${workflow.name} passed validation.`
          : `${workflow.name} has validation errors: ${validation.errors.join(" ")}`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Validation failed.") });
    },
  });

  const publishWorkflow = useMutation({
    mutationFn: async (workflow: WorkflowSummary) => {
      const response = await api.post<Workflow>(`/workflows/${workflow.id}/publish`);
      return response.data;
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setNotice({ tone: "success", text: `${workflow.name} was published.` });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Workflow could not be published.") });
    },
  });

  function openCreateDialog() {
    setFormError("");
    setNotice(null);
    setDialog({ mode: "create", form: { ...emptyWorkflowForm } });
  }

  function openEditDialog(workflow: WorkflowSummary) {
    setFormError("");
    setNotice(null);
    setDialog({ mode: "edit", form: workflowToForm(workflow) });
  }

  function updateForm(next: Partial<WorkflowFormState>) {
    if (!dialog) {
      return;
    }
    setDialog({ ...dialog, form: { ...dialog.form, ...next } });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) {
      return;
    }
    saveWorkflow.mutate(dialog);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Workflow design
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Workflows
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Manage workflow records, graph versions, publication status, and validation readiness.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New workflow
          </button>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_180px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search workflows</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search workflows, categories, descriptions"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WorkflowStatus | "ALL")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {workflowsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : workflowsQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Workflows unavailable" message="The API could not return workflows." />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={GitBranch} title="No matching workflows" message="Adjust your search or status filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Versions</th>
                  <th className="px-4 py-3">Graph</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredWorkflows.map((workflow) => (
                  <tr key={workflow.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950 dark:text-white">{workflow.name}</div>
                      <div className="mt-1 max-w-xl text-xs text-slate-500 dark:text-slate-400">
                        {workflow.category} - {workflow.description ?? "No description"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusStyles[workflow.status]}`}>
                        {workflow.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div>{workflow.version_count} total</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Published v{workflow.published_version_number ?? "-"} - Draft v{workflow.draft_version_number ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {workflow.node_count} nodes · {workflow.edge_count} edges
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {workflow.created_by_name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedWorkflowId(workflow.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label={`View ${workflow.name}`}
                          title="View definition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => validateWorkflow.mutate(workflow)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label={`Validate ${workflow.name}`}
                          title="Validate workflow"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        {canManage ? (
                          <>
                            <Link
                              to={`/workflows/${workflow.id}/builder`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                              aria-label={`Open builder for ${workflow.name}`}
                              title="Open builder"
                            >
                              <Wrench className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => publishWorkflow.mutate(workflow)}
                              disabled={!workflow.draft_version_number || publishWorkflow.isPending}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                              aria-label={`Publish ${workflow.name}`}
                              title="Publish draft"
                            >
                              <Rocket className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditDialog(workflow)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                              aria-label={`Edit ${workflow.name}`}
                              title="Edit workflow"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog ? (
        <Modal
          title={dialog.mode === "create" ? "Create workflow" : "Edit workflow"}
          description="Phase 3 edits workflow metadata. The visual graph builder arrives in Phase 4."
          onClose={() => setDialog(null)}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
                <input
                  value={dialog.form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
                <input
                  value={dialog.form.category}
                  onChange={(event) => updateForm({ category: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Description</span>
              <textarea
                value={dialog.form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            {formError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveWorkflow.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                {saveWorkflow.isPending ? "Saving" : "Save workflow"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedWorkflowId !== null ? (
        <Modal
          title={selectedWorkflowQuery.data?.name ?? "Workflow definition"}
          description="Latest graph version stored in the database."
          onClose={() => setSelectedWorkflowId(null)}
        >
          {selectedWorkflowQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : selectedWorkflowQuery.error || !selectedWorkflowQuery.data?.latest_version ? (
            <EmptyState icon={GitBranch} title="Definition unavailable" message="This workflow definition could not be loaded." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">Version</p>
                  <p className="mt-1 font-semibold">v{selectedWorkflowQuery.data.latest_version.version_number}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">State</p>
                  <p className="mt-1 font-semibold">
                    {selectedWorkflowQuery.data.latest_version.is_draft ? "Draft" : "Published"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">Published</p>
                  <p className="mt-1 font-semibold">
                    {formatDate(selectedWorkflowQuery.data.latest_version.published_at)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                  Nodes
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {selectedWorkflowQuery.data.latest_version.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-950 dark:text-white">{node.title}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {node.node_type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{node.node_key}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                  Edges
                </h3>
                <div className="mt-3 space-y-2">
                  {selectedWorkflowQuery.data.latest_version.edges.map((edge) => (
                    <div
                      key={edge.id}
                      className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>
                        {edge.source_node_key} -&gt; {edge.target_node_key}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {edge.label ?? edge.edge_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>
      ) : null}
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
