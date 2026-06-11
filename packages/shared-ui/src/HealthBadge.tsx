interface HealthBadgeProps {
  status: "ok" | "degraded" | "error";
  label?: string;
}

const statusColors: Record<HealthBadgeProps["status"], string> = {
  ok: "#22c55e",
  degraded: "#eab308",
  error: "#ef4444",
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
        backgroundColor: "rgba(255,255,255,0.06)",
        fontSize: "0.875rem",
        color: "#e2e8f0",
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
