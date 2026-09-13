import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { StatCard } from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import type { DashboardSummary } from "../types/dashboard";
import { formatRole, getRoleTheme } from "../utils/roles";

async function getDashboardSummary() {
  const response = await api.get<DashboardSummary>("/dashboard/summary");
  return response.data;
}

export function DashboardPage() {
  const { user } = useAuth();
  const roleTheme = getRoleTheme(user?.role);
  const { data, error, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <h1 className="text-lg font-semibold">Dashboard unavailable</h1>
        <p className="mt-2 text-sm">The API could not return the dashboard summary.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className={`rounded-lg border p-6 shadow-sm ${roleTheme.hero}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={`text-sm font-semibold uppercase tracking-normal ${roleTheme.text}`}>
              Operations overview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">
              FlowForge command center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Workflow design, request intake, approvals, task fulfilment, and execution telemetry are connected to the FastAPI backend.
            </p>
            {user ? (
              <p className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${roleTheme.badge}`}>
                {formatRole(user.role)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <ShieldCheck className={`h-5 w-5 ${roleTheme.text}`} />
            <div>
              <p className="text-sm font-semibold">JWT protected</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Session stored locally</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={FileCheck2} label="Active requests" value={data.active_requests} tone="blue" />
        <StatCard icon={Clock3} label="Pending approvals" value={data.pending_approvals} tone="amber" />
        <StatCard icon={ClipboardList} label="Open tasks" value={data.open_tasks} tone="rose" />
        <StatCard icon={CheckCircle2} label="Completed" value={data.completed_requests} tone="teal" />
        <StatCard icon={ShieldCheck} label="Rejected" value={data.rejected_requests} tone="slate" />
        <StatCard icon={GitBranch} label="Published workflows" value={data.published_workflows} tone="slate" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Role coverage</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Seeded demo accounts for the five planned access profiles.
              </p>
            </div>
            <FileCheck2 className="h-5 w-5 text-forge-600 dark:text-forge-300" />
          </div>
          <div className="mt-5 space-y-3">
            {data.role_counts.map((role) => (
              <div key={role.role}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {role.role.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{role.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${roleTheme.progress}`}
                    style={{ width: `${Math.max(12, role.count * 20)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Build status</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                The first slice is intentionally narrow and ready for workflow features.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-300" />
          </div>
          <div className="mt-5 space-y-3 text-sm">
            {[
              "FastAPI app package",
              "SQLite database models",
              "JWT login and /me endpoint",
              "Seeded demo organization",
              "Protected React application shell",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950"
              >
                <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
