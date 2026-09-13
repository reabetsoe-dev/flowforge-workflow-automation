import { BellRing, CheckCheck, CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { NotificationDialog } from "../components/NotificationDialog";
import { StatCard } from "../components/StatCard";
import { api } from "../services/api";
import type { Notification } from "../types/execution";
import { getApiErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

async function getNotifications() {
  const response = await api.get<Notification[]>("/notifications");
  return response.data;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const notificationsQuery = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const filteredNotifications = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notifications.filter((notification) => {
      const matchesUnread = !showUnreadOnly || !notification.is_read;
      const matchesSearch =
        !term ||
        notification.title.toLowerCase().includes(term) ||
        notification.message.toLowerCase().includes(term);
      return matchesUnread && matchesSearch;
    });
  }, [notifications, search, showUnreadOnly]);

  const markRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await api.post<Notification>(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setNotice({ tone: "success", text: "Notification marked as read." });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Notification could not be updated.") });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const response = await api.post<Notification[]>("/notifications/read-all");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setNotice({ tone: "success", text: "All notifications marked as read." });
    },
    onError: (error) => {
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Notifications could not be updated.") });
    },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Activity alerts
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Notifications
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Internal workflow alerts for approvals, tasks, and completed request updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || unreadCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          Mark all read
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={BellRing} label="Notifications" value={notifications.length} tone="blue" />
        <StatCard icon={BellRing} label="Unread" value={unreadCount} tone="amber" />
        <StatCard icon={CheckCircle2} label="Read" value={notifications.length - unreadCount} tone="teal" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search notifications</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search notifications"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(event) => setShowUnreadOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-forge-600 focus:ring-forge-500"
            />
            Unread only
          </label>
        </div>

        {notificationsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : notificationsQuery.error ? (
          <div className="p-4">
            <EmptyState icon={ShieldAlert} title="Notifications unavailable" message="The API could not return notifications." />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={BellRing} title="No notifications found" message="Adjust the search or unread filter." />
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredNotifications.map((notification) => (
              <article key={notification.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950 dark:text-white">{notification.title}</h2>
                    {!notification.is_read ? (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
                        Unread
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read ? (
                  <button
                    type="button"
                    onClick={() => markRead.mutate(notification.id)}
                    disabled={markRead.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Mark read
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
