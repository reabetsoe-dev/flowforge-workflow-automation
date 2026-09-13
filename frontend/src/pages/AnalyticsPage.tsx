import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  GitBranch,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "../components/EmptyState";
import { StatCard } from "../components/StatCard";
import { api } from "../services/api";
import type { AnalyticsDashboard, MetricPoint } from "../types/analytics";
import { formatDateTime, formatDuration, formatStatus } from "../utils/format";

const chartColors = ["#2563eb", "#14b8a6", "#f59e0b", "#e11d48", "#64748b", "#7c3aed"];

async function getAnalytics() {
  const response = await api.get<AnalyticsDashboard>("/analytics/dashboard");
  return response.data;
}

function chartData(points: MetricPoint[]) {
  return points.map((point) => ({ name: formatStatus(point.label), value: point.value }));
}

export function AnalyticsPage() {
  const analyticsQuery = useQuery({ queryKey: ["analytics-dashboard"], queryFn: getAnalytics });

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-lg bg-white dark:bg-slate-900" />
          ))}
        </div>
      </div>
    );
  }

  if (analyticsQuery.error || !analyticsQuery.data) {
    return (
      <EmptyState icon={ShieldAlert} title="Analytics unavailable" message="The API could not return analytics data." />
    );
  }

  const data = analyticsQuery.data;
  const slowestStage = data.bottlenecks[0];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
          Portfolio analytics
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
          Workflow analytics
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Operational metrics are calculated from workflow instances, approval outcomes, task waits, and event timestamps.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Gauge} label="Executions" value={data.total_executions} tone="blue" />
        <StatCard icon={CheckCircle2} label="Completed" value={data.completed} tone="teal" />
        <StatCard icon={XCircle} label="Rejected" value={data.rejected} tone="rose" />
        <StatCard icon={Activity} label="Running" value={data.running} tone="amber" />
        <StatCard icon={Clock3} label="Avg cycle" value={formatDuration(data.average_processing_seconds)} tone="slate" />
      </section>

      {slowestStage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="text-sm font-semibold">
            {slowestStage.node_title ?? slowestStage.node_key} currently has the highest average wait time.
          </p>
          <p className="mt-1 text-sm">
            {slowestStage.workflow_name ?? "Workflow"} averages {formatDuration(slowestStage.average_wait_seconds)} across {slowestStage.sample_size} completed wait event(s).
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Requests per month</h2>
            <BarChart3 className="h-5 w-5 text-forge-600 dark:text-forge-300" />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.requests_per_month}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Requests by workflow</h2>
            <GitBranch className="h-5 w-5 text-forge-600 dark:text-forge-300" />
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData(data.executions_by_workflow)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Approval outcomes</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData(data.approval_outcomes)} dataKey="value" nameKey="name" outerRadius={95} label>
                  {data.approval_outcomes.map((_, index) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Requests by department</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData(data.executions_by_department)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {data.recent_activity.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatStatus(item.action)}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {item.actor_name ?? "System"} - {formatDateTime(item.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Recent requests</h2>
          <div className="mt-4 space-y-3">
            {data.recent_requests.map((request) => (
              <Link
                key={request.id}
                to={`/requests/${request.id}`}
                className="block rounded-lg border border-slate-200 p-3 transition hover:border-forge-200 hover:bg-forge-50 dark:border-slate-800 dark:hover:border-forge-900 dark:hover:bg-forge-950/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-950 dark:text-white">{request.reference_number}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatStatus(request.status)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {request.workflow_name ?? "Workflow"} - {request.current_stage_title ?? "No active stage"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
