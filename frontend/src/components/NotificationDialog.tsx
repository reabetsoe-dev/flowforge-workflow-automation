import { AlertTriangle, CheckCircle2 } from "lucide-react";

export type NotificationDialogState = {
  tone: "success" | "error";
  text: string;
};

type NotificationDialogProps = {
  notice: NotificationDialogState | null;
  onClose: () => void;
};

const toneStyles: Record<NotificationDialogState["tone"], string> = {
  success: "bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-900",
  error: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900",
};

export function NotificationDialog({ notice, onClose }: NotificationDialogProps) {
  if (!notice) {
    return null;
  }

  const Icon = notice.tone === "success" ? CheckCircle2 : AlertTriangle;
  const title = notice.tone === "success" ? "Notification" : "Action needed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notification-dialog-title"
        aria-describedby="notification-dialog-message"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-panel dark:border-slate-800 dark:bg-slate-950"
      >
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-lg ring-1 ${toneStyles[notice.tone]}`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="notification-dialog-title" className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">
          {title}
        </h2>
        <p id="notification-dialog-message" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {notice.text}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex h-11 min-w-28 items-center justify-center rounded-lg bg-forge-600 px-5 text-sm font-semibold text-white transition hover:bg-forge-700 focus:outline-none focus:ring-2 focus:ring-forge-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          autoFocus
        >
          OK
        </button>
      </section>
    </div>
  );
}
