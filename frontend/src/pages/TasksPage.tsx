import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  Play,
  Search,
  ShieldAlert,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { NotificationDialog } from "../components/NotificationDialog";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import type { Task, TaskStatus, WorkflowInstance } from "../types/execution";
import { getApiErrorMessage } from "../utils/errors";
import { formatDateTime, formatStatus } from "../utils/format";

type TaskDialogState = {
  task: Task;
  comments: string;
};

const statusStyles: Record<TaskStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
  COMPLETED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  OVERDUE: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
};

async function getTasks() {
  const response = await api.get<Task[]>("/tasks");
  return response.data;
}

function canWorkOnTask(task: Task, userRole: string | undefined, userId: number | undefined) {
  if (!userRole || !userId || task.status === "COMPLETED") {
    return false;
  }
  if (userRole === "ADMINISTRATOR") {
    return true;
  }
  if (task.assigned_user_id && task.assigned_user_id === userId) {
    return true;
  }
  return task.assigned_role === userRole;
}

function isOpenTask(task: Task) {
  return task.status === "PENDING" || task.status === "IN_PROGRESS";
}

export function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [dialog, setDialog] = useState<TaskDialogState | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: getTasks });
  const tasks = tasksQuery.data ?? [];

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
      const matchesSearch =
        !term ||
        (task.reference_number ?? "").toLowerCase().includes(term) ||
        (task.workflow_name ?? "").toLowerCase().includes(term) ||
        (task.requester_name ?? "").toLowerCase().includes(term) ||
        task.title.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, tasks]);

  const openCount = tasks.filter(isOpenTask).length;
  const pendingCount = tasks.filter((task) => task.status === "PENDING").length;
  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const completedCount = tasks.filter((task) => task.status === "COMPLETED").length;

  function invalidateTaskQueries(instance: WorkflowInstance) {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["instances"] });
    queryClient.invalidateQueries({ queryKey: ["instance", instance.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  }

  const startTask = useMutation({
    mutationFn: async (task: Task) => {
      const response = await api.post<WorkflowInstance>(`/tasks/${task.id}/start`, {});
      return response.data;
    },
    onSuccess: (instance) => {
      invalidateTaskQueries(instance);
      setNotice({ tone: "success", text: `${instance.reference_number} task started.` });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Task could not be started.") });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (state: TaskDialogState) => {
      const response = await api.post<WorkflowInstance>(
        `/tasks/${state.task.id}/complete`,
        { comments: state.comments.trim() || null },
      );
      return response.data;
    },
    onSuccess: (instance) => {
      invalidateTaskQueries(instance);
      setDialog(null);
      setNotice({ tone: "success", text: `${instance.reference_number} task completed.` });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Task could not be completed.") });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog) {
      completeTask.mutate(dialog);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Manager workbench
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            My tasks
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Start assigned fulfilment tasks, complete them with notes, and unblock the next workflow stage.
          </p>
        </div>
        <Link
          to="/approvals"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Approvals
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Open" value={openCount} tone="amber" />
        <StatCard icon={ClipboardCheck} label="Pending" value={pendingCount} tone="slate" />
        <StatCard icon={Play} label="In progress" value={inProgressCount} tone="blue" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} tone="teal" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search tasks</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search references, workflows, requesters"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "ALL")}
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

        {tasksQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : tasksQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Tasks unavailable" message="The API could not return tasks." />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={ClipboardCheck} title="No tasks found" message="Adjust the search or status filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const canAct = canWorkOnTask(task, user?.role, user?.id);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {task.reference_number ?? "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {task.workflow_name ?? "Workflow"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{task.title}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {task.description ?? task.node_title ?? task.node_key}
                        </div>
                        {task.comments ? (
                          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                            {task.comments}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {task.requester_name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {task.requester_department_name ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusStyles[task.status]}`}>
                          {formatStatus(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateTime(task.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canAct && task.status === "PENDING" ? (
                            <button
                              type="button"
                              onClick={() => startTask.mutate(task)}
                              disabled={startTask.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-200 dark:hover:bg-blue-950/40"
                            >
                              <Play className="h-4 w-4" aria-hidden="true" />
                              Start
                            </button>
                          ) : null}
                          {canAct && task.status !== "COMPLETED" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setNotice(null);
                                setDialog({ task, comments: "" });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-teal-200 dark:hover:bg-teal-950/40"
                            >
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              Complete
                            </button>
                          ) : null}
                          <Link
                            to={`/requests/${task.workflow_instance_id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={`Open ${task.reference_number ?? "request"}`}
                            title="Open request"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog ? (
        <Modal
          title="Complete task"
          description={dialog.task.reference_number ?? dialog.task.workflow_name ?? dialog.task.title}
          onClose={() => setDialog(null)}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comments</span>
              <textarea
                value={dialog.comments}
                onChange={(event) => setDialog({ ...dialog, comments: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                placeholder="Add completion notes"
              />
            </label>
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
                disabled={completeTask.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {completeTask.isPending ? "Completing" : "Complete task"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
