import { ArrowRight, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

import { ThemeToggle } from "../components/ThemeToggle";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative flex min-h-screen overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/flowforge-operations-bg.png')] bg-cover bg-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.92)_0%,rgba(15,23,42,0.78)_44%,rgba(15,23,42,0.28)_100%)]"
        />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3" aria-label="FlowForge home">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-forge-700 shadow-panel">
                <GitBranch className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-semibold">FlowForge</span>
                <span className="block text-xs font-medium uppercase tracking-normal text-slate-300">
                  Workflow automation
                </span>
              </span>
            </Link>

            <ThemeToggle />
          </header>

          <div className="flex flex-1 items-center py-12 sm:py-16">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-200">
                Visual workflow operations
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-normal sm:text-6xl lg:text-7xl">FlowForge</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl">
                Build, launch, approve, and audit business workflows from one professional command center.
              </p>
              <Link
                to="/login"
                className="mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-forge-600 px-6 text-sm font-semibold text-white shadow-panel transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-300 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 pb-5 text-sm text-slate-200 sm:grid-cols-3">
            {["Workflow design", "Approval routing", "Audit-ready history"].map((label) => (
              <div key={label} className="rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 backdrop-blur">
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
