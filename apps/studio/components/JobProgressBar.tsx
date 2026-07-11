"use client";

interface Props {
  progress: number | null | undefined;
  label?: string | null;
  className?: string;
}

const DEFAULT_WRAPPER_CLASS = "flex flex-col gap-1.5 text-xs text-muted-foreground";

/** Live job progress — matches JobsWorkspace styling. */
export function JobProgressBar({ progress, label, className }: Props) {
  if (progress == null) {
    return null;
  }

  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={className ?? DEFAULT_WRAPPER_CLASS}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
      <span>{label?.trim() || `${clamped}%`}</span>
    </div>
  );
}
