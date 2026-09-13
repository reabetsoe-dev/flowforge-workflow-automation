import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export function AccessDeniedPage() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 flex-none" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold">Access denied</h1>
            <p className="mt-1 text-sm">
              Your current role does not have permission to view this workspace area.
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
