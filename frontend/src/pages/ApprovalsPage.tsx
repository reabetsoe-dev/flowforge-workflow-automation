import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRoundCheck,
  XCircle,
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
import type { Approval, ApprovalStatus, WorkflowInstance } from "../types/execution";
import { getApiErrorMessage } from "../utils/errors";
import { formatDateTime, formatStatus } from "../utils/format";

type ApprovalAction = "approve" | "reject" | "request-changes";
type ApprovalDialogState = {
  action: ApprovalAction;
  approval: Approval;
  comments: string;
};

const statusStyles: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  APPROVED: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
  CHANGES_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900",
};

const actionCopy: Record<ApprovalAction, { title: string; endpoint: string; button: string }> = {
  approve: { title: "Approve request", endpoint: "approve", button: "Approve" },
  reject: { title: "Reject request", endpoint: "reject", button: "Reject" },
  "request-changes": {
    title: "Request changes",
    endpoint: "request-changes",
    button: "Request changes",
  },
};

async function getApprovals() {
  const response = await api.get<Approval[]>("/approvals");
  return response.data;
}

function canRespondToApproval(approval: Approval, userRole: string | undefined, userId: number | undefined) {
  if (!userRole || !userId || approval.status !== "PENDING") {
    return false;
  }
  if (userRole === "ADMINISTRATOR") {
    return true;
  }
  if (approval.assigned_user_id && approval.assigned_user_id === userId) {
    return true;
  }
  return approval.assigned_role === userRole;
}

export function ApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "ALL">("PENDING");
  const [dialog, setDialog] = useState<ApprovalDialogState | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const approvalsQuery = useQuery({ queryKey: ["approvals"], queryFn: getApprovals });
  const approvals = approvalsQuery.data ?? [];

  const filteredApprovals = useMemo(() => {
    const term = search.trim().toLowerCase();
    return approvals.filter((approval) => {
      const matchesStatus = statusFilter === "ALL" || approval.status === statusFilter;
      const matchesSearch =
        !term ||
        (approval.reference_number ?? "").toLowerCase().includes(term) ||
        (approval.workflow_name ?? "").toLowerCase().includes(term) ||
        (approval.requester_name ?? "").toLowerCase().includes(term) ||
        (approval.node_title ?? approval.node_key).toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [approvals, search, statusFilter]);

  const pendingCount = approvals.filter((approval) => approval.status === "PENDING").length;
  const approvedCount = approvals.filter((approval) => approval.status === "APPROVED").length;
  const rejectedCount = approvals.filter((approval) => approval.status === "REJECTED").length;
  const changesCount = approvals.filter((approval) => approval.status === "CHANGES_REQUESTED").length;

  const respondToApproval = useMutation({
    mutationFn: async (state: ApprovalDialogState) => {
      const action = actionCopy[state.action];
      const response = await api.post<WorkflowInstance>(
        `/approvals/${state.approval.id}/${action.endpoint}`,
        { comments: state.comments.trim() || null },
      );
      return { instance: response.data, action: state.action };
    },
    onSuccess: ({ instance, action }) => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      queryClient.invalidateQueries({ queryKey: ["instance", instance.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDialog(null);
      setNotice({
        tone: "success",
        text: `${instance.reference_number} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent back for changes"}.`,
      });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Approval action failed.") });
    },
  });

  function openDialog(action: ApprovalAction, approval: Approval) {
    setNotice(null);
    setDialog({ action, approval, comments: "" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog) {
      respondToApproval.mutate(dialog);
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
            Approvals
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Review assigned approvals, leave decision comments, and move requests to the next workflow stage.
          </p>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          My tasks
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Pending" value={pendingCount} tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={approvedCount} tone="teal" />
        <StatCard icon={XCircle} label="Rejected" value={rejectedCount} tone="rose" />
        <StatCard icon={RotateCcw} label="Changes" value={changesCount} tone="slate" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search approvals</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search references, workflows, requesters"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ApprovalStatus | "ALL")}
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

        {approvalsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : approvalsQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Approvals unavailable" message="The API could not return approvals." />
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={UserRoundCheck} title="No approvals found" message="Adjust the search or status filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Step</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredApprovals.map((approval) => {
                  const canAct = canRespondToApproval(approval, user?.role, user?.id);
                  return (
                    <tr key={approval.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-950 dark:text-white">
                          {approval.reference_number ?? "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {approval.workflow_name ?? "Workflow"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {approval.node_title ?? approval.node_key}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {approval.requester_name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {approval.requester_department_name ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusStyles[approval.status]}`}>
                          {formatStatus(approval.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateTime(approval.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canAct ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openDialog("approve", approval)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-teal-200 dark:hover:bg-teal-950/40"
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openDialog("request-changes", approval)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-orange-200 dark:hover:bg-orange-950/40"
                              >
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                Changes
                              </button>
                              <button
                                type="button"
                                onClick={() => openDialog("reject", approval)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-rose-200 dark:hover:bg-rose-950/40"
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                Reject
                              </button>
                            </>
                          ) : null}
                          <Link
                            to={`/requests/${approval.workflow_instance_id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={`Open ${approval.reference_number ?? "request"}`}
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
          title={actionCopy[dialog.action].title}
          description={dialog.approval.reference_number ?? dialog.approval.workflow_name ?? "Approval"}
          onClose={() => setDialog(null)}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Comments</span>
              <textarea
                value={dialog.comments}
                onChange={(event) => setDialog({ ...dialog, comments: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                placeholder="Add decision notes"
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
                disabled={respondToApproval.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {respondToApproval.isPending ? "Submitting" : actionCopy[dialog.action].button}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
