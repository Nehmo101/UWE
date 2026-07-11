import { HealthBadge } from "@uwe/shared-ui";
import { Card, CardContent, CardTitle, cn } from "@/src/components/ui";

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
  const headingId = `status-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <Card className={cn(wide && "col-span-full")} aria-labelledby={headingId}>
      <CardContent className="flex flex-col gap-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle id={headingId}>{title}</CardTitle>
          <HealthBadge status={badgeStatus} label={statusLabel} />
        </div>

        <p className="text-sm text-muted-foreground">{message}</p>

        {details.length > 0 && (
          <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-[0.85rem]">
            {details.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-sm text-muted-foreground">{item.label}</dt>
                <dd className="m-0 text-foreground">{formatDetailValue(item.value)}</dd>
              </div>
            ))}
          </dl>
        )}

        {nextSteps.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm text-muted-foreground">Nächste Schritte:</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {nextSteps.map((step) => (
                <li
                  key={step}
                  className="rounded-[0.55rem] border border-border bg-card px-[0.8rem] py-[0.55rem] text-[0.88rem]"
                >
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
