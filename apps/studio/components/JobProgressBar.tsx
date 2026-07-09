"use client";

interface Props {
  progress: number | null | undefined;
  label?: string | null;
  className?: string;
}

/** Live job progress — matches JobsWorkspace styling. */
export function JobProgressBar({ progress, label, className }: Props) {
  if (progress == null) {
    return null;
  }

  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={className ?? "uwe-jobs-progress"} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="uwe-jobs-progress-bar" style={{ width: `${clamped}%` }} />
      <span>{label?.trim() || `${clamped}%`}</span>
    </div>
  );
}
