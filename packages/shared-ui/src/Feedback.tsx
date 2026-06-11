import type { ReactNode } from "react";

export function LoadingSpinner({
  label = "Laden…",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="uwe-loading" role="status" aria-live="polite">
      <span className={`uwe-spinner uwe-spinner-${size}`} aria-hidden />
      <span className="uwe-loading-label">{label}</span>
    </div>
  );
}

export function ErrorAlert({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="uwe-error-alert" role="alert">
      {title && <strong className="uwe-error-title">{title}</strong>}
      <p className="uwe-error-message">{message}</p>
      {action && <div className="uwe-error-action">{action}</div>}
    </div>
  );
}

export function LoadingPage({ label = "Seite wird geladen…" }: { label?: string }) {
  return (
    <div className="uwe-loading-page">
      <LoadingSpinner label={label} size="lg" />
    </div>
  );
}
