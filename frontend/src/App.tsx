import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";
import { useAuth } from "./hooks/useAuth";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { AvailableWorkflowsPage } from "./pages/AvailableWorkflowsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { LandingPage } from "./pages/LandingPage";
import { MyRequestsPage } from "./pages/MyRequestsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { WorkflowBuilderPage } from "./pages/WorkflowBuilderPage";
import { WorkflowsPage } from "./pages/WorkflowsPage";
import type { UserRole } from "./types/auth";

function ProtectedRoute() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 text-ink-700 dark:bg-ink-900 dark:text-ink-100">
        <div className="h-12 w-12 rounded-full border-4 border-ink-200 border-t-forge-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: JSX.Element;
}) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/available-workflows" element={<AvailableWorkflowsPage />} />
          <Route path="/requests" element={<MyRequestsPage />} />
          <Route path="/requests/:instanceId" element={<RequestDetailPage />} />
          <Route
            path="/approvals"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "MANAGER"]}>
                <ApprovalsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "MANAGER"]}>
                <TasksPage />
              </RoleRoute>
            }
          />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/analytics"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "WORKFLOW_DESIGNER", "AUDITOR"]}>
                <AnalyticsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "AUDITOR"]}>
                <AuditLogsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/users"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR"]}>
                <UsersPage />
              </RoleRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR"]}>
                <DepartmentsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "WORKFLOW_DESIGNER", "AUDITOR"]}>
                <WorkflowsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/workflows/:workflowId/builder"
            element={
              <RoleRoute allowedRoles={["ADMINISTRATOR", "WORKFLOW_DESIGNER"]}>
                <WorkflowBuilderPage />
              </RoleRoute>
            }
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
