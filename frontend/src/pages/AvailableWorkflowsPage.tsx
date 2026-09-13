import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileInput,
  GitBranch,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { api } from "../services/api";
import type { StartWorkflowInput, WorkflowInstance } from "../types/execution";
import type { Workflow, WorkflowNode, WorkflowSummary } from "../types/workflow";
import { getApiErrorMessage } from "../utils/errors";
import { formatDate, formatFieldLabel } from "../utils/format";

type LaunchFormField = {
  label: string;
  field_key: string;
  type: string;
  required: boolean;
  options: string[];
  minimum?: number;
};

type LaunchFormValues = Record<string, string>;

async function getWorkflows() {
  const response = await api.get<WorkflowSummary[]>("/workflows");
  return response.data;
}

async function getWorkflow(id: number) {
  const response = await api.get<Workflow>(`/workflows/${id}`);
  return response.data;
}

function readFormFields(workflow: Workflow | undefined): LaunchFormField[] {
  const nodes = workflow?.latest_version?.nodes ?? [];
  return nodes
    .filter((node) => node.node_type === "FORM")
    .flatMap((node) => normalizeNodeFields(node));
}

function normalizeNodeFields(node: WorkflowNode): LaunchFormField[] {
  const fields = node.configuration_json.fields;
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.flatMap((field) => {
    if (!field || typeof field !== "object") {
      return [];
    }
    const rawField = field as Record<string, unknown>;
    const fieldKey = typeof rawField.field_key === "string" ? rawField.field_key : "";
    if (!fieldKey) {
      return [];
    }

    const rawOptions = Array.isArray(rawField.options) ? rawField.options : [];
    const minimum = rawField.minimum;
    return [
      {
        label:
          typeof rawField.label === "string" && rawField.label.trim()
            ? rawField.label
            : formatFieldLabel(fieldKey),
        field_key: fieldKey,
        type: typeof rawField.type === "string" ? rawField.type.toLowerCase() : "text",
        required: rawField.required === true,
        options: rawOptions.filter((option): option is string => typeof option === "string"),
        minimum: typeof minimum === "number" ? minimum : undefined,
      },
    ];
  });
}

function initialFormValues(fields: LaunchFormField[]): LaunchFormValues {
  return Object.fromEntries(fields.map((field) => [field.field_key, ""]));
}

function buildSubmittedData(fields: LaunchFormField[], values: LaunchFormValues) {
  return fields.reduce<Record<string, unknown>>((payload, field) => {
    const value = values[field.field_key] ?? "";
    if (field.type === "number" || field.type === "currency") {
      payload[field.field_key] = value === "" ? "" : Number(value);
      return payload;
    }
    payload[field.field_key] = value;
    return payload;
  }, {});
}

export function AvailableWorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<LaunchFormValues>({});
  const [formError, setFormError] = useState("");

  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: getWorkflows });
  const selectedWorkflowQuery = useQuery({
    queryKey: ["workflow", selectedWorkflowId],
    queryFn: () => getWorkflow(selectedWorkflowId as number),
    enabled: selectedWorkflowId !== null,
  });

  const publishedWorkflows = useMemo(
    () => (workflowsQuery.data ?? []).filter((workflow) => workflow.status === "PUBLISHED"),
    [workflowsQuery.data],
  );
  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(publishedWorkflows.map((workflow) => workflow.category))).sort()],
    [publishedWorkflows],
  );
  const filteredWorkflows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return publishedWorkflows.filter((workflow) => {
      const matchesCategory = categoryFilter === "ALL" || workflow.category === categoryFilter;
      const matchesSearch =
        !term ||
        workflow.name.toLowerCase().includes(term) ||
        workflow.category.toLowerCase().includes(term) ||
        (workflow.description ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, publishedWorkflows, search]);

  const selectedWorkflow = selectedWorkflowQuery.data;
  const launchFields = useMemo(() => readFormFields(selectedWorkflow), [selectedWorkflow]);

  useEffect(() => {
    if (selectedWorkflow) {
      setFormValues(initialFormValues(launchFields));
      setFormError("");
    }
  }, [launchFields, selectedWorkflow]);

  const startWorkflow = useMutation({
    mutationFn: async (workflowId: number) => {
      const payload: StartWorkflowInput = {
        submitted_data_json: buildSubmittedData(launchFields, formValues),
      };
      const response = await api.post<WorkflowInstance>(`/workflows/${workflowId}/start`, payload);
      return response.data;
    },
    onSuccess: (instance) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setSelectedWorkflowId(null);
      navigate(`/requests/${instance.id}`);
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Request could not be submitted."));
    },
  });

  function openLaunch(workflowId: number) {
    setFormError("");
    setFormValues({});
    setSelectedWorkflowId(workflowId);
  }

  function updateField(fieldKey: string, value: string) {
    setFormValues((current) => ({ ...current, [fieldKey]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedWorkflowId === null) {
      return;
    }
    startWorkflow.mutate(selectedWorkflowId);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Request launch
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Available workflows
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Start a published business workflow and track it from intake through approvals, tasks, and completion.
          </p>
        </div>
        <Link
          to="/requests"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          My requests
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px]">
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
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by category"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "ALL" ? "All categories" : category}
              </option>
            ))}
          </select>
        </div>

        {workflowsQuery.isLoading ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : workflowsQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Workflows unavailable" message="The API could not return workflows." />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={GitBranch} title="No workflows found" message="Adjust the search or category filter." />
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredWorkflows.map((workflow) => (
              <article
                key={workflow.id}
                className="flex min-h-56 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      {workflow.category}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                      {workflow.name}
                    </h2>
                  </div>
                  <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900">
                    Live
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {workflow.description ?? "No description supplied."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                    <span className="block font-semibold text-slate-700 dark:text-slate-200">
                      v{workflow.published_version_number ?? "-"}
                    </span>
                    Published
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                    <span className="block font-semibold text-slate-700 dark:text-slate-200">
                      {workflow.node_count}
                    </span>
                    Nodes
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDate(workflow.updated_at)}
                  </div>
                  <button
                    type="button"
                    onClick={() => openLaunch(workflow.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                  >
                    <FileInput className="h-4 w-4" aria-hidden="true" />
                    Start
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedWorkflowId !== null ? (
        <Modal
          title={selectedWorkflow?.name ?? "Start workflow"}
          description={selectedWorkflow?.category}
          onClose={() => setSelectedWorkflowId(null)}
        >
          {selectedWorkflowQuery.isLoading ? (
            <div className="h-44 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : selectedWorkflowQuery.error || !selectedWorkflow ? (
            <EmptyState icon={ShieldAlert} title="Workflow unavailable" message="The workflow definition could not be loaded." />
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white text-forge-600 shadow-sm dark:bg-slate-900 dark:text-forge-300">
                    <Sparkles className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {selectedWorkflow.description ?? "Submit this workflow for routing."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Version {selectedWorkflow.latest_version?.version_number ?? "-"} will be used for this request.
                    </p>
                  </div>
                </div>
              </div>

              {launchFields.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No launch fields" message="This workflow can be submitted without extra details." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {launchFields.map((field) => (
                    <label
                      key={field.field_key}
                      className={field.type === "textarea" ? "block sm:col-span-2" : "block"}
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {field.label}
                        {field.required ? <span className="text-rose-600"> *</span> : null}
                      </span>
                      {field.type === "textarea" ? (
                        <textarea
                          value={formValues[field.field_key] ?? ""}
                          onChange={(event) => updateField(field.field_key, event.target.value)}
                          required={field.required}
                          className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      ) : field.type === "dropdown" ? (
                        <select
                          value={formValues[field.field_key] ?? ""}
                          onChange={(event) => updateField(field.field_key, event.target.value)}
                          required={field.required}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Select {field.label.toLowerCase()}</option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            field.type === "date"
                              ? "date"
                              : field.type === "number" || field.type === "currency"
                                ? "number"
                                : "text"
                          }
                          min={field.minimum}
                          step={field.type === "currency" ? "0.01" : undefined}
                          value={formValues[field.field_key] ?? ""}
                          onChange={(event) => updateField(field.field_key, event.target.value)}
                          required={field.required}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}

              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                  {formError}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWorkflowId(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startWorkflow.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
                >
                  {startWorkflow.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  Submit request
                </button>
              </div>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
