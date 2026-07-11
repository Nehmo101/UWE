import type { ReactNode } from "react";

const SPINNER_SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function LoadingSpinner({
  label = "Laden…",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="inline-flex items-center gap-2.5 text-muted-foreground" role="status" aria-live="polite">
      <span
        className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-primary ${SPINNER_SIZE_CLASSES[size]}`}
        aria-hidden
      />
      <span className="text-sm">{label}</span>
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
    <div
      className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground"
      role="alert"
    >
      {title && <strong className="mb-1.5 block text-destructive">{title}</strong>}
      <p className="m-0 leading-normal break-words">{message}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

export function LoadingPage({ label = "Seite wird geladen…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner label={label} size="lg" />
    </div>
  );
}
