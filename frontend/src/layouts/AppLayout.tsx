import {
  Bell,
  BellRing,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemeToggle } from "../components/ThemeToggle";
import { NotificationDialog } from "../components/NotificationDialog";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import type { UserRole } from "../types/auth";
import type { Notification } from "../types/execution";
import { getApiErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";
import { formatRole, getRoleTheme } from "../utils/roles";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  roles: UserRole[];
};

const allRoles: UserRole[] = [
  "ADMINISTRATOR",
  "WORKFLOW_DESIGNER",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
];

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true, roles: allRoles },
  {
    label: "Available Workflows",
    href: "/available-workflows",
    icon: BriefcaseBusiness,
    enabled: true,
    roles: ["ADMINISTRATOR", "WORKFLOW_DESIGNER", "MANAGER", "EMPLOYEE"],
  },
  {
    label: "My Requests",
    href: "/requests",
    icon: FileClock,
    enabled: true,
    roles: allRoles,
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: ShieldCheck,
    enabled: true,
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    label: "My Tasks",
    href: "/tasks",
    icon: ClipboardCheck,
    enabled: true,
    roles: ["ADMINISTRATOR", "MANAGER"],
  },
  {
    label: "Workflows",
    href: "/workflows",
    icon: GitBranch,
    enabled: true,
    roles: ["ADMINISTRATOR", "WORKFLOW_DESIGNER", "AUDITOR"],
  },
  {
    label: "Workflow Builder",
    href: "/workflows",
    icon: Wrench,
    enabled: true,
    roles: ["ADMINISTRATOR", "WORKFLOW_DESIGNER"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: Gauge,
    enabled: true,
    roles: ["ADMINISTRATOR", "WORKFLOW_DESIGNER", "AUDITOR"],
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: BellRing,
    enabled: true,
    roles: allRoles,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    enabled: true,
    roles: ["ADMINISTRATOR", "AUDITOR"],
  },
  { label: "Users", href: "/users", icon: Users, enabled: true, roles: ["ADMINISTRATOR"] },
  {
    label: "Departments",
    href: "/departments",
    icon: Building2,
    enabled: true,
    roles: ["ADMINISTRATOR"],
  },
  {
    label: "Settings",
    href: "/dashboard",
    icon: ClipboardList,
    enabled: false,
    roles: ["ADMINISTRATOR"],
  },
];

async function getNotifications() {
  const response = await api.get<Notification[]>("/notifications");
  return response.data;
}

export function AppLayout() {
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const roleTheme = getRoleTheme(user?.role);
  const visibleNavItems = navItems.filter((item) => user && item.roles.includes(user.role));
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    enabled: Boolean(user),
    refetchInterval: 30000,
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const recentNotifications = notifications.slice(0, 5);
  const markAllRead = useMutation({
    mutationFn: async () => {
      const response = await api.post<Notification[]>("/notifications/read-all");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setNotificationsOpen(false);
      setNotice({ tone: "success", text: "All notifications marked as read." });
    },
    onError: (error) => {
      setNotificationsOpen(false);
      setNotice({ tone: "error", text: getApiErrorMessage(error, "Notifications could not be updated.") });
    },
  });

  return (
    <div className={`min-h-screen text-slate-950 dark:text-slate-100 ${roleTheme.shell}`}>
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-white shadow-panel ${roleTheme.solid}`}>
            <GitBranch className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-normal">FlowForge</p>
            <p className={`text-xs font-medium uppercase tracking-normal ${roleTheme.text}`}>
              {roleTheme.name} workspace
            </p>
          </div>
        </div>

        <nav className="mt-8 space-y-1" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return item.enabled ? (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? roleTheme.activeNav
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 dark:text-slate-600"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </span>
                <span className="text-xs">Soon</span>
              </div>
            );
          })}
        </nav>

        <div className={`mt-auto rounded-lg border p-4 ${roleTheme.profilePanel}`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.full_name}</p>
          <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
          <p className={`mt-3 inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${roleTheme.badge}`}>
            {user ? formatRole(user.role) : ""}
          </p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className={`sticky top-0 z-20 border-b backdrop-blur ${roleTheme.header}`}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${roleTheme.solid}`}>
                <GitBranch className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block font-semibold">FlowForge</span>
                <span className={`block text-xs font-semibold ${roleTheme.text}`}>{roleTheme.name}</span>
              </div>
            </div>

            <label className="ml-auto hidden w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:flex">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
                placeholder="Search requests, people, workflows"
                disabled
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">Notifications</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markAllRead.mutate()}
                      disabled={unreadCount === 0 || markAllRead.isPending}
                      className="text-xs font-semibold text-forge-700 hover:text-forge-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-forge-300"
                    >
                      Mark all
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
                        No notifications.
                      </p>
                    ) : (
                      recentNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800"
                        >
                          <div className="flex items-start gap-2">
                            {!notification.is_read ? (
                              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-rose-600" />
                            ) : (
                              <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-slate-300 dark:bg-slate-700" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                {formatDateTime(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-semibold text-forge-700 hover:bg-slate-50 dark:border-slate-800 dark:text-forge-300 dark:hover:bg-slate-900"
                  >
                    View all
                  </Link>
                </div>
              ) : null}
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <nav
            className="flex gap-2 overflow-x-auto border-t border-slate-200 px-4 py-2 dark:border-slate-800 lg:hidden"
            aria-label="Mobile navigation"
          >
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return item.enabled ? (
                <NavLink
                  key={item.label}
                  to={item.href}
                  className={({ isActive }) =>
                    `inline-flex flex-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? roleTheme.activeNav
                        : "text-slate-600 dark:text-slate-300"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ) : null;
            })}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <NotificationDialog notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
