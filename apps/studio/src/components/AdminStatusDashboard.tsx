import { HealthBadge } from "@uwe/shared-ui";

export type StatusLevel = "ok" | "degraded" | "error" | "disabled";

export interface StatusCardProps {
  title: string;
  level: StatusLevel;
  statusLabel: string;
  message: string;
  details?: Array<{ label: string; value: string | number | boolean | null }>;
  nextSteps?: string[];
  wide?: boolean;
}

function levelToBadge(level: StatusLevel): "ok" | "degraded" | "error" {
  if (level === "ok" || level === "disabled") {
    return "ok";
  }
  if (level === "degraded") {
    return "degraded";
  }
  return "error";
}

function formatDetailValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nein";
  }
  return String(value);
}

export function StatusCard({
  title,
  level,
  statusLabel,
  message,
  details = [],
  nextSteps = [],
  wide = false,
}: StatusCardProps) {
  const badgeStatus = level === "disabled" ? "ok" : levelToBadge(level);

  return (
    <section
      className={`uwe-card uwe-dashboard-card${wide ? " uwe-dashboard-card-wide" : ""}`}
      aria-labelledby={`status-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <h2 className="uwe-section-title" id={`status-${title.replace(/\s+/g, "-").toLowerCase()}`}>
          {title}
        </h2>
        <HealthBadge status={badgeStatus} label={statusLabel} />
      </div>

      <p className="uwe-dashboard-muted" style={{ marginBottom: details.length > 0 ? "0.75rem" : 0 }}>
        {message}
      </p>

      {details.length > 0 && (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(8rem, auto) 1fr",
            gap: "0.35rem 1rem",
            margin: "0 0 0.75rem",
            fontSize: "0.85rem",
          }}
        >
          {details.map((item) => (
            <div key={item.label} style={{ display: "contents" }}>
              <dt className="uwe-dashboard-muted">{item.label}</dt>
              <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{formatDetailValue(item.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {nextSteps.length > 0 && (
        <div>
          <p className="uwe-dashboard-muted" style={{ marginBottom: "0.35rem" }}>
            Nächste Schritte:
          </p>
          <ul className="uwe-inspector-findings" style={{ margin: 0 }}>
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
