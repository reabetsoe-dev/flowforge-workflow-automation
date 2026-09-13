import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  FileClock,
  GitBranch,
  ShieldAlert,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { api } from "../services/api";
import type {
  ApprovalStatus,
  TaskStatus,
  WorkflowEvent,
  WorkflowInstance,
  WorkflowInstanceStatus,
} from "../types/execution";
import { formatDateTime, formatFieldLabel, formatJsonValue, formatStatus } from "../utils/format";

const instanceStatusStyles: Record<WorkflowInstanceStatus, string> = {
  RUNNING: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  WAITING_FOR_TASK: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
  COMPLETED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

const approvalStatusStyles: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  APPROVED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
};

const taskStatusStyles: Record<TaskStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  COMPLETED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  OVERDUE: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
};

async function getInstance(id: number) {
  const response = await api.get<WorkflowInstance>(`/instances/${id}`);
  return response.data;
}

function sortedEvents(events: WorkflowEvent[]) {
  return [...events].sort(
    (first, second) => new Date(first.created_at).getTime() - new Date(second.created_at).getTime(),
  );
}

function eventIcon(eventType: string) {
  if (eventType.includes("APPROVAL")) {
    return UserRoundCheck;
  }
  if (eventType.includes("TASK")) {
    return ClipboardCheck;
  }
  if (eventType.includes("COMPLETED")) {
    return CheckCircle2;
  }
  if (eventType.includes("REJECTED")) {
    return XCircle;
  }
  return CircleDot;
}

export function RequestDetailPage() {
  const params = useParams<{ instanceId: string }>();
  const instanceId = Number(params.instanceId);
  const isValidId = Number.isInteger(instanceId) && instanceId > 0;

  const instanceQuery = useQuery({
    queryKey: ["instance", instanceId],
    queryFn: () => getInstance(instanceId),
    enabled: isValidId,
  });

  if (!isValidId) {
    return (
      <EmptyState icon={ShieldAlert} title="Request unavailable" message="The request identifier is not valid." />
    );
  }

  if (instanceQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="h-96 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
          <div className="h-96 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
        </div>
      </div>
    );
  }

  if (instanceQuery.error || !instanceQuery.data) {
    return (
      <EmptyState icon={ShieldAlert} title="Request unavailable" message="The API could not return this workflow instance." />
    );
  }

  const instance = instanceQuery.data;
  const dataEntries = Object.entries(instance.submitted_data_json);
  const events = sortedEvents(instance.events);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              to="/requests"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forge-700 hover:text-forge-800 dark:text-forge-300"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to requests
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
              {instance.workflow_name ?? "Workflow request"}
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-slate-950 dark:text-white">
              {instance.reference_number}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Current stage: {instance.current_stage_title ?? "No active stage"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${instanceStatusStyles[instance.status]}`}>
              {formatStatus(instance.status)}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Updated {formatDateTime(instance.updated_at)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Request data</h2>
              <FileClock className="h-5 w-5 text-forge-600 dark:text-forge-300" aria-hidden="true" />
            </div>
            {dataEntries.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No submitted data.</p>
            ) : (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {dataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950">
                    <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      {formatFieldLabel(key)}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                      {formatJsonValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Approvals</h2>
              <UserRoundCheck className="h-5 w-5 text-forge-600 dark:text-forge-300" aria-hidden="true" />
            </div>
            {instance.approvals.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No approval steps have been created.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {instance.approvals.map((approval) => (
                  <article key={approval.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-950 dark:text-white">
                          {approval.node_title ?? approval.node_key}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Assigned to {approval.assigned_role ? formatStatus(approval.assigned_role) : "specific user"}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold ring-1 ${approvalStatusStyles[approval.status]}`}>
                        {formatStatus(approval.status)}
                      </span>
                    </div>
                    {approval.comments ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                        {approval.comments}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Created {formatDateTime(approval.created_at)}
                      {approval.responded_at ? ` - Responded ${formatDateTime(approval.responded_at)}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Tasks</h2>
              <ClipboardCheck className="h-5 w-5 text-forge-600 dark:text-forge-300" aria-hidden="true" />
            </div>
            {instance.tasks.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No tasks have been created.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {instance.tasks.map((task) => (
                  <article key={task.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-950 dark:text-white">{task.title}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {task.node_title ?? task.node_key}
                        </p>
                      </div>
                      <span className={`inline-flex w-fit rounded-md px-2 py-1 text-xs font-semibold ring-1 ${taskStatusStyles[task.status]}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    {task.description ? (
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{task.description}</p>
                    ) : null}
                    {task.comments ? (
                      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                        {task.comments}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      Created {formatDateTime(task.created_at)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Timeline</h2>
            <GitBranch className="h-5 w-5 text-forge-600 dark:text-forge-300" aria-hidden="true" />
          </div>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No workflow events recorded.</p>
          ) : (
            <div className="mt-5">
              {events.map((event, index) => {
                const Icon = eventIcon(event.event_type);
                return (
                  <article key={event.id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
                    {index < events.length - 1 ? (
                      <span className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px bg-slate-200 dark:bg-slate-800" />
                    ) : null}
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {formatStatus(event.event_type)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatDateTime(event.created_at)}
                        </span>
                      </div>
                      {event.node_title ? (
                        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {event.node_title}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
