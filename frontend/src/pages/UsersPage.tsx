import { Edit3, Plus, Search, UserCheck, Users } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { NotificationDialog } from "../components/NotificationDialog";
import { api } from "../services/api";
import type { User, UserCreateInput, UserRole, UserUpdateInput } from "../types/auth";
import type { Department } from "../types/department";
import { getApiErrorMessage } from "../utils/errors";
import { formatRole, roleOptions } from "../utils/roles";

type UserFormState = {
  id?: number;
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  department_id: string;
  active: boolean;
};

type DialogState =
  | { mode: "create"; form: UserFormState }
  | { mode: "edit"; form: UserFormState };

const emptyUserForm: UserFormState = {
  full_name: "",
  email: "",
  password: "Demo123!",
  role: "EMPLOYEE",
  department_id: "",
  active: true,
};

async function getUsers() {
  const response = await api.get<User[]>("/users");
  return response.data;
}

async function getDepartments() {
  const response = await api.get<Department[]>("/departments");
  return response.data;
}

function userToForm(user: User): UserFormState {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    password: "",
    role: user.role,
    department_id: user.department_id ? String(user.department_id) : "",
    active: user.active,
  };
}

function statusBadge(active: boolean) {
  return active
    ? "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900"
    : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: getDepartments });

  const saveUser = useMutation({
    mutationFn: async (state: DialogState) => {
      const departmentId = state.form.department_id ? Number(state.form.department_id) : null;
      if (state.mode === "create") {
        const payload: UserCreateInput = {
          full_name: state.form.full_name.trim(),
          email: state.form.email.trim(),
          password: state.form.password,
          role: state.form.role,
          department_id: departmentId,
          active: state.form.active,
        };
        const response = await api.post<User>("/users", payload);
        return response.data;
      }

      const payload: UserUpdateInput = {
        full_name: state.form.full_name.trim(),
        email: state.form.email.trim(),
        role: state.form.role,
        department_id: departmentId,
        active: state.form.active,
      };
      if (state.form.password.trim()) {
        payload.password = state.form.password;
      }
      const response = await api.put<User>(`/users/${state.form.id}`, payload);
      return response.data;
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDialog(null);
      setFormError("");
      setNotice(`${user.full_name} was saved.`);
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "User could not be saved."));
    },
  });

  const users = usersQuery.data ?? [];
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.full_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.department_name ?? "").toLowerCase().includes(term);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.active) ||
        (statusFilter === "INACTIVE" && !user.active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  function openCreateDialog() {
    setFormError("");
    setNotice("");
    setDialog({ mode: "create", form: { ...emptyUserForm } });
  }

  function openEditDialog(user: User) {
    setFormError("");
    setNotice("");
    setDialog({ mode: "edit", form: userToForm(user) });
  }

  function updateForm(next: Partial<UserFormState>) {
    if (!dialog) {
      return;
    }
    setDialog({ ...dialog, form: { ...dialog.form, ...next } });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) {
      return;
    }
    saveUser.mutate(dialog);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Administration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Users
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Manage demo users, role assignments, departments, and account status.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New user
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:grid-cols-[1fr_220px_180px]">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search users</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search users, email, department"
            />
          </label>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as UserRole | "ALL")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by role"
          >
            <option value="ALL">All roles</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-800 dark:bg-slate-950"
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {usersQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : usersQuery.error ? (
          <div className="p-4">
            <EmptyState icon={Users} title="Users unavailable" message="The API could not return users." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Users} title="No matching users" message="Adjust your search or filter criteria." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-950 dark:text-white">{user.full_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </td>
                    <td className="px-4 py-3">{formatRole(user.role)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {user.department_name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${statusBadge(user.active)}`}>
                        {user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditDialog(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label={`Edit ${user.full_name}`}
                        title="Edit user"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog ? (
        <Modal
          title={dialog.mode === "create" ? "Create user" : "Edit user"}
          description="Administrators can update roles, department assignment, and account status."
          onClose={() => setDialog(null)}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Full name</span>
                <input
                  value={dialog.form.full_name}
                  onChange={(event) => updateForm({ full_name: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                <input
                  value={dialog.form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                  type="email"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</span>
                <select
                  value={dialog.form.role}
                  onChange={(event) => updateForm({ role: event.target.value as UserRole })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Department</span>
                <select
                  value={dialog.form.department_id}
                  onChange={(event) => updateForm({ department_id: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Unassigned</option>
                  {(departmentsQuery.data ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {dialog.mode === "create" ? "Password" : "New password"}
              </span>
              <input
                value={dialog.form.password}
                onChange={(event) => updateForm({ password: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                minLength={8}
                placeholder={dialog.mode === "edit" ? "Leave blank to keep current password" : ""}
                required={dialog.mode === "create"}
                type="password"
              />
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
              <input
                checked={dialog.form.active}
                onChange={(event) => updateForm({ active: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-forge-600 focus:ring-forge-500"
                type="checkbox"
              />
              Account is active
            </label>

            {formError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {formError}
              </div>
            ) : null}

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
                disabled={saveUser.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                {saveUser.isPending ? "Saving" : "Save user"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      <NotificationDialog
        notice={notice ? { tone: "success", text: notice } : null}
        onClose={() => setNotice("")}
      />
    </div>
  );
}
