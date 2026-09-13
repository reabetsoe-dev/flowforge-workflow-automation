import { FileSearch, ScrollText, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { api } from "../services/api";
import type { AuditLog } from "../types/audit";
import { formatDateTime, formatStatus } from "../utils/format";

async function getAuditLogs(search: string, action: string, entityType: string) {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (action !== "ALL") {
    params.set("action", action);
  }
  if (entityType !== "ALL") {
    params.set("entity_type", entityType);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await api.get<AuditLog[]>(`/audit-logs${suffix}`);
  return response.data;
}

export function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");

  const auditQuery = useQuery({
    queryKey: ["audit-logs", search, actionFilter, entityFilter],
    queryFn: () => getAuditLogs(search, actionFilter, entityFilter),
  });
  const logs = auditQuery.data ?? [];
  const actions = useMemo(() => ["ALL", ...Array.from(new Set(logs.map((log) => log.action))).sort()], [logs]);
  const entityTypes = useMemo(() => ["ALL", ...Array.from(new Set(logs.map((log) => log.entity_type))).sort()], [logs]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
          Read-only governance
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
          Audit logs
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Search system activity across authentication, workflow publishing, request execution, approvals, and tasks.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px_220px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search audit logs</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search actions, entities, descriptions"
            />
          </label>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by action"
          >
            {actions.map((action) => (
              <option key={action} value={action}>
                {action === "ALL" ? "All actions" : formatStatus(action)}
              </option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by entity type"
          >
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType === "ALL" ? "All entities" : entityType}
              </option>
            ))}
          </select>
        </div>

        {auditQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : auditQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Audit logs unavailable" message="The API could not return audit logs." />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={FileSearch} title="No audit logs found" message="Adjust filters or generate more workflow activity." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {log.user_name ?? "System"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {log.user_email ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                        {formatStatus(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.description}</td>
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
