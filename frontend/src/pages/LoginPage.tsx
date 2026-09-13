import { ArrowLeft, ArrowRight, Eye, EyeOff, GitBranch, Lock, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { NotificationDialog } from "../components/NotificationDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types/auth";
import { getRoleTheme } from "../utils/roles";

const demoAccounts: Array<{ label: string; email: string; role: UserRole }> = [
  { label: "Administrator", email: "admin@flowforge.local", role: "ADMINISTRATOR" },
  { label: "Workflow Designer", email: "designer@flowforge.local", role: "WORKFLOW_DESIGNER" },
  { label: "Manager", email: "manager@flowforge.local", role: "MANAGER" },
  { label: "Employee", email: "employee@flowforge.local", role: "EMPLOYEE" },
  { label: "Auditor", email: "auditor@flowforge.local", role: "AUDITOR" },
] as const;

const demoPassword = "Demo123!";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("admin@flowforge.local");
  const [password, setPassword] = useState(demoPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectedDemo = demoAccounts.find((account) => account.email === email) ?? demoAccounts[0];
  const selectedDemoEmail = selectedDemo.email === email ? selectedDemo.email : "";
  const roleTheme = getRoleTheme(selectedDemo.role);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="relative overflow-hidden bg-slate-950 text-slate-950 dark:text-white"
      style={{ height: "100dvh", minHeight: "100dvh" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/flowforge-operations-bg.png')] bg-cover bg-center"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/60" />
      <div aria-hidden="true" className="absolute inset-0 bg-white/10 dark:bg-slate-950/25" />

      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Home
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative z-10 flex h-full items-center justify-center px-4 py-14 sm:px-6">
        <div
          className="rounded-lg border border-white/40 bg-white/95 p-5 shadow-panel backdrop-blur-xl dark:border-white/20 dark:bg-slate-950/95 sm:p-6"
          style={{ width: "min(420px, calc(100vw - 32px))" }}
        >
          <Link to="/" className="mb-5 flex items-center justify-center gap-3" aria-label="FlowForge home">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${roleTheme.solid}`}>
              <GitBranch className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-semibold text-slate-950 dark:text-white">FlowForge</span>
              <span className="block text-xs font-medium uppercase tracking-normal text-slate-500 dark:text-slate-400">
                Workflow automation
              </span>
            </span>
          </Link>

          <div className="text-center">
            <p className={`text-xs font-semibold uppercase tracking-normal ${roleTheme.text}`}>
              Welcome back
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
              Access your workspace
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-700 dark:text-slate-200">
              Choose a demo role or sign in manually. All demo users use{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{demoPassword}</span>.
            </p>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck className={`h-4 w-4 ${roleTheme.text}`} aria-hidden="true" />
                Demo account
              </span>
              <select
                value={selectedDemoEmail}
                onChange={(event) => {
                  if (!event.target.value) {
                    return;
                  }
                  setEmail(event.target.value);
                  setPassword(demoPassword);
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="" disabled>
                  Custom email
                </option>
                {demoAccounts.map((account) => (
                  <option key={account.email} value={account.email}>
                    {account.label} - {account.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email</span>
              <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-slate-400 dark:border-slate-700 dark:bg-slate-900">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm text-slate-950 outline-none dark:text-white"
                  autoComplete="email"
                  type="email"
                  required
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Password</span>
              <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-slate-400 dark:border-slate-700 dark:bg-slate-900">
                <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full min-w-0 bg-transparent text-sm text-slate-950 outline-none dark:text-white"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-forge-500 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-900 ${roleTheme.solid} ${roleTheme.solidHover}`}
            >
              {submitting ? "Signing in" : "Sign in"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
      <NotificationDialog
        notice={error ? { tone: "error", text: error } : null}
        onClose={() => setError("")}
      />
    </main>
  );
}
