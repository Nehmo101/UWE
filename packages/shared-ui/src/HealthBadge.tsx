interface HealthBadgeProps {
  status: "ok" | "degraded" | "error";
  label?: string;
}

const statusColors: Record<HealthBadgeProps["status"], string> = {
  ok: "var(--uwe-success)",
  degraded: "var(--uwe-warning)",
  error: "var(--uwe-danger)",
};

export function HealthBadge({ status, label = status }: HealthBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.25rem 0.75rem",
        borderRadius: "9999px",
        backgroundColor: "color-mix(in srgb, var(--uwe-fg) 6%, transparent)",
        fontSize: "0.875rem",
        color: "var(--uwe-fg)",
      }}
    >
      <span
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "50%",
          backgroundColor: statusColors[status],
        }}
      />
      {label}
    </span>
  );
}
