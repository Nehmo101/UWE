interface HealthBadgeProps {
  status: "ok" | "degraded" | "error";
  label?: string;
}

const statusDotClasses: Record<HealthBadgeProps["status"], string> = {
  ok: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
};

export function HealthBadge({ status, label = status }: HealthBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--uwe-fg)_6%,transparent)] px-3 py-1 text-sm text-foreground">
      <span className={`h-2 w-2 rounded-full ${statusDotClasses[status]}`} />
      {label}
    </span>
  );
}
