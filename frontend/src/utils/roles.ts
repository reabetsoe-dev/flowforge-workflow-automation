import type { UserRole } from "../types/auth";

export const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "WORKFLOW_DESIGNER", label: "Workflow Designer" },
  { value: "MANAGER", label: "Manager" },
  { value: "EMPLOYEE", label: "Employee" },
  { value: "AUDITOR", label: "Auditor" },
];

export function formatRole(role: UserRole | string) {
  return roleOptions.find((option) => option.value === role)?.label ?? role.replace(/_/g, " ");
}

export type RoleTheme = {
  name: string;
  tone: "blue" | "violet" | "amber" | "teal" | "cyan";
  solid: string;
  solidHover: string;
  text: string;
  soft: string;
  activeNav: string;
  badge: string;
  profilePanel: string;
  shell: string;
  header: string;
  hero: string;
  progress: string;
};

export const roleThemes: Record<UserRole, RoleTheme> = {
  ADMINISTRATOR: {
    name: "Administrator",
    tone: "blue",
    solid: "bg-blue-700",
    solidHover: "hover:bg-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    soft: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
    activeNav: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
    badge: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900",
    profilePanel: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30",
    shell: "bg-blue-50/40 dark:bg-slate-950",
    header: "border-blue-100 bg-white/95 dark:border-blue-950 dark:bg-slate-950/95",
    hero: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/25",
    progress: "bg-blue-700 dark:bg-blue-400",
  },
  WORKFLOW_DESIGNER: {
    name: "Workflow Designer",
    tone: "violet",
    solid: "bg-violet-700",
    solidHover: "hover:bg-violet-800",
    text: "text-violet-700 dark:text-violet-300",
    soft:
      "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900",
    activeNav: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
    badge:
      "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-900",
    profilePanel: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30",
    shell: "bg-violet-50/40 dark:bg-slate-950",
    header: "border-violet-100 bg-white/95 dark:border-violet-950 dark:bg-slate-950/95",
    hero: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/25",
    progress: "bg-violet-700 dark:bg-violet-400",
  },
  MANAGER: {
    name: "Manager",
    tone: "amber",
    solid: "bg-amber-600",
    solidHover: "hover:bg-amber-700",
    text: "text-amber-700 dark:text-amber-300",
    soft:
      "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
    activeNav: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    badge:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900",
    profilePanel: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    shell: "bg-amber-50/40 dark:bg-slate-950",
    header: "border-amber-100 bg-white/95 dark:border-amber-950 dark:bg-slate-950/95",
    hero: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25",
    progress: "bg-amber-600 dark:bg-amber-400",
  },
  EMPLOYEE: {
    name: "Employee",
    tone: "teal",
    solid: "bg-teal-700",
    solidHover: "hover:bg-teal-800",
    text: "text-teal-700 dark:text-teal-300",
    soft: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900",
    activeNav: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-200",
    badge: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-900",
    profilePanel: "border-teal-200 bg-teal-50/70 dark:border-teal-900 dark:bg-teal-950/30",
    shell: "bg-teal-50/40 dark:bg-slate-950",
    header: "border-teal-100 bg-white/95 dark:border-teal-950 dark:bg-slate-950/95",
    hero: "border-teal-200 bg-teal-50/70 dark:border-teal-900 dark:bg-teal-950/25",
    progress: "bg-teal-700 dark:bg-teal-400",
  },
  AUDITOR: {
    name: "Auditor",
    tone: "cyan",
    solid: "bg-cyan-700",
    solidHover: "hover:bg-cyan-800",
    text: "text-cyan-700 dark:text-cyan-300",
    soft: "bg-cyan-50 text-cyan-700 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900",
    activeNav: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
    badge: "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/60 dark:text-cyan-200 dark:ring-cyan-900",
    profilePanel: "border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30",
    shell: "bg-cyan-50/40 dark:bg-slate-950",
    header: "border-cyan-100 bg-white/95 dark:border-cyan-950 dark:bg-slate-950/95",
    hero: "border-cyan-200 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/25",
    progress: "bg-cyan-700 dark:bg-cyan-400",
  },
};

export function getRoleTheme(role: UserRole | null | undefined) {
  return role ? roleThemes[role] : roleThemes.EMPLOYEE;
}
