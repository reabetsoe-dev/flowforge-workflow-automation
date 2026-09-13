import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  ListFilter,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { StatCard } from "../components/StatCard";
import { api } from "../services/api";
import type { WorkflowInstance, WorkflowInstanceStatus } from "../types/execution";
import { formatDateTime, formatStatus } from "../utils/format";

const statusStyles: Record<WorkflowInstanceStatus, string> = {
  RUNNING: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  WAITING_FOR_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  WAITING_FOR_TASK: "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
  COMPLETED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
};

async function getInstances() {
  const response = await api.get<WorkflowInstance[]>("/instances");
  return response.data;
}

function isActive(status: WorkflowInstanceStatus) {
  return ["RUNNING", "WAITING_FOR_APPROVAL", "WAITING_FOR_TASK", "CHANGES_REQUESTED"].includes(status);
}

export function MyRequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkflowInstanceStatus | "ALL">("ALL");

  const instancesQuery = useQuery({ queryKey: ["instances"], queryFn: getInstances });
  const instances = instancesQuery.data ?? [];

  const filteredInstances = useMemo(() => {
    const term = search.trim().toLowerCase();
    return instances.filter((instance) => {
      const matchesStatus = statusFilter === "ALL" || instance.status === statusFilter;
      const matchesSearch =
        !term ||
        instance.reference_number.toLowerCase().includes(term) ||
        (instance.workflow_name ?? "").toLowerCase().includes(term) ||
        (instance.current_stage_title ?? "").toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [instances, search, statusFilter]);

  const activeCount = instances.filter((instance) => isActive(instance.status)).length;
  const completedCount = instances.filter((instance) => instance.status === "COMPLETED").length;
  const pendingApprovals = instances.reduce(
    (count, instance) => count + instance.approvals.filter((approval) => approval.status === "PENDING").length,
    0,
  );
  const openTasks = instances.reduce(
    (count, instance) =>
      count + instance.tasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS").length,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Request tracking
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            My requests
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Review submitted workflow instances, current stages, approval waits, and fulfilment tasks.
          </p>
        </div>
        <Link
          to="/available-workflows"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <FileClock className="h-4 w-4" aria-hidden="true" />
          New request
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={FileClock} label="Total requests" value={instances.length} tone="blue" />
        <StatCard icon={Clock3} label="Active" value={activeCount} tone="amber" />
        <StatCard icon={ListFilter} label="Open approvals" value={pendingApprovals} tone="slate" />
        <StatCard icon={ClipboardCheck} label="Open tasks" value={openTasks} tone="rose" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} tone="teal" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search requests</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search requests, workflows, stages"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WorkflowInstanceStatus | "ALL")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            {Object.keys(statusStyles).map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {instancesQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : instancesQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Requests unavailable" message="The API could not return workflow instances." />
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={FileClock} title="No requests found" message="Submit a workflow or adjust the current filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current stage</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredInstances.map((instance) => (
                  <tr key={instance.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">
                      {instance.reference_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {instance.workflow_name ?? "Workflow"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Started {formatDateTime(instance.started_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusStyles[instance.status]}`}>
                        {formatStatus(instance.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {instance.current_stage_title ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDateTime(instance.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/requests/${instance.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label={`Open ${instance.reference_number}`}
                        title="Open request"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
