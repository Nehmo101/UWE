"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/states";
import { Badge } from "@/src/components/ui/badge";
import type {
  FailedLoginsResult,
  OpenPortsResult,
  RecentErrorsResult,
} from "@uwe/host-monitor";
import { formatClock } from "./format";

/** Tiny inline SVG sparkline in the Parchment accent colour. */
export function Sparkline({
  values,
  max,
  width = 72,
  height = 20,
}: {
  values: number[];
  max?: number;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="uwe-v2-stat-label">sammelt Verlauf…</span>;
  }
  const peak = Math.max(max ?? Math.max(...values), 1);
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (Math.max(0, Math.min(value, peak)) / peak) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-primary"
      role="img"
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Unavailable({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function OpenPortsPanel({ data }: { data: OpenPortsResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offene Ports</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.available ? (
          <Unavailable message={data.message} />
        ) : data.ports.length === 0 ? (
          <EmptyState icon="shield-check" title="Keine lauschenden Ports" />
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {data.ports.map((port) => (
              <div
                key={`${port.proto}-${port.address}-${port.port}`}
                className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="default">{port.proto.toUpperCase()}</Badge>
                  <span className="font-mono">{port.address}:{port.port}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{port.process ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentErrorsPanel({ data }: { data: RecentErrorsResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Letzte Fehler (Journal)</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.available ? (
          <Unavailable message={data.message} />
        ) : data.entries.length === 0 ? (
          <EmptyState icon="shield-check" title="Keine Fehler im Journal" />
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {data.entries.map((entry, index) => (
              <div key={index} className="border-b border-border/60 py-1.5 last:border-0">
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {formatClock(entry.timestamp)}
                </span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FailedLoginsPanel({ data }: { data: FailedLoginsResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fehlgeschlagene Anmeldungen</CardTitle>
      </CardHeader>
      <CardContent>
        {!data.available ? (
          <Unavailable message={data.message} />
        ) : data.recent.length === 0 ? (
          <EmptyState icon="shield-check" title="Keine fehlgeschlagenen Anmeldungen" />
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {data.recent.map((login, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <span className="uwe-dot uwe-dot-warning" aria-hidden />
                  <span className="font-mono">{login.user ?? "—"}</span>
                  <span className="text-muted-foreground">von {login.from ?? "—"}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{login.when ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
