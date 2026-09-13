import { Building2, Edit3, Plus, Search } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { NotificationDialog } from "../components/NotificationDialog";
import { api } from "../services/api";
import type {
  Department,
  DepartmentCreateInput,
  DepartmentUpdateInput,
} from "../types/department";
import { getApiErrorMessage } from "../utils/errors";

type DepartmentFormState = {
  id?: number;
  name: string;
  description: string;
};

type DialogState =
  | { mode: "create"; form: DepartmentFormState }
  | { mode: "edit"; form: DepartmentFormState };

const emptyDepartmentForm: DepartmentFormState = {
  name: "",
  description: "",
};

async function getDepartments() {
  const response = await api.get<Department[]>("/departments");
  return response.data;
}

function departmentToForm(department: Department): DepartmentFormState {
  return {
    id: department.id,
    name: department.name,
    description: department.description ?? "",
  };
}

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: getDepartments });
  const departments = departmentsQuery.data ?? [];

  const filteredDepartments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return departments.filter((department) => {
      return (
        !term ||
        department.name.toLowerCase().includes(term) ||
        (department.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [departments, search]);

  const saveDepartment = useMutation({
    mutationFn: async (state: DialogState) => {
      const description = state.form.description.trim() || null;
      if (state.mode === "create") {
        const payload: DepartmentCreateInput = {
          name: state.form.name.trim(),
          description,
        };
        const response = await api.post<Department>("/departments", payload);
        return response.data;
      }

      const payload: DepartmentUpdateInput = {
        name: state.form.name.trim(),
        description,
      };
      const response = await api.put<Department>(`/departments/${state.form.id}`, payload);
      return response.data;
    },
    onSuccess: (department) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDialog(null);
      setFormError("");
      setNotice(`${department.name} was saved.`);
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Department could not be saved."));
    },
  });

  function openCreateDialog() {
    setFormError("");
    setNotice("");
    setDialog({ mode: "create", form: { ...emptyDepartmentForm } });
  }

  function openEditDialog(department: Department) {
    setFormError("");
    setNotice("");
    setDialog({ mode: "edit", form: departmentToForm(department) });
  }

  function updateForm(next: Partial<DepartmentFormState>) {
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
    saveDepartment.mutate(dialog);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-forge-600 dark:text-forge-300">
            Administration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            Departments
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Maintain the FlowForge Industries department directory used for user
            assignment and future request routing.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New department
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <label className="flex max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Search departments</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search departments"
            />
          </label>
        </div>

        {departmentsQuery.isLoading ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : departmentsQuery.error ? (
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="Departments unavailable"
              message="The API could not return departments."
            />
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title="No matching departments"
              message="Adjust your search criteria."
            />
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDepartments.map((department) => (
              <article
                key={department.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white">
                        {department.name}
                      </h2>
                      <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {department.description ?? "No description yet."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditDialog(department)}
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label={`Edit ${department.name}`}
                    title="Edit department"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {department.user_count} assigned user{department.user_count === 1 ? "" : "s"}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {dialog ? (
        <Modal
          title={dialog.mode === "create" ? "Create department" : "Edit department"}
          description="Departments are used for people organization now and workflow routing later."
          onClose={() => setDialog(null)}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
              <input
                value={dialog.form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Description
              </span>
              <textarea
                value={dialog.form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forge-500 dark:border-slate-700 dark:bg-slate-950"
              />
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
                disabled={saveDepartment.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-forge-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900"
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                {saveDepartment.isPending ? "Saving" : "Save department"}
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
