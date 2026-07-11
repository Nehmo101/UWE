"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { HealthLight, HealthMetrics } from "@uwe/database/health-metrics";
import { RtxStatusBadge } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  rtxReadinessSourceLabelDe,
  type StudioRtxDisplayState,
} from "@/src/lib/rtx-display-ui";
import { Alert, Button, cn } from "@/src/components/ui";

const LIGHT_LABEL: Record<HealthLight, string> = {
  green: "Grün — alles im grünen Bereich",
  yellow: "Gelb — beobachten",
  red: "Rot — Handlungsbedarf",
};

const LIGHT_TEXT_CLASS: Record<HealthLight, string> = {
  green: "text-success",
  yellow: "text-warning",
  red: "text-destructive",
};

const LIGHT_DOT_CLASS: Record<HealthLight, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-destructive",
};

interface HealthSnapshot {
  checkedAt: string;
  light: HealthLight;
  dbSizeLabel: string;
}

export interface SystemHealthClientProps {
  initialMetrics: HealthMetrics;
  initialRtxDisplay: StudioRtxDisplayState | null;
}

export function SystemHealthClient({
  initialMetrics,
  initialRtxDisplay,
}: SystemHealthClientProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [rtxDisplay, setRtxDisplay] = useState(initialRtxDisplay);
  const [history, setHistory] = useState<HealthSnapshot[]>([
    {
      checkedAt: new Date().toISOString(),
      light: initialMetrics.light,
      dbSizeLabel: initialMetrics.dbSizeLabel,
    },
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/health-metrics"));
      if (!response.ok) {
        throw new Error(`Health-Check fehlgeschlagen (${response.status}).`);
      }
      const data = (await response.json()) as {
        metrics: HealthMetrics;
        rtxDisplay: StudioRtxDisplayState | null;
        checkedAt: string;
      };
      setMetrics(data.metrics);
      setRtxDisplay(data.rtxDisplay);
      setHistory((current) =>
        [
          {
            checkedAt: data.checkedAt,
            light: data.metrics.light,
            dbSizeLabel: data.metrics.dbSizeLabel,
          },
          ...current,
        ].slice(0, 5),
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unbekannter Fehler");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const maxCount = Math.max(1, ...metrics.largestTables.map((table) => table.count));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Health-Ampel</h1>
            <p className="text-sm text-muted-foreground">
              Was macht UWE langsam? Datenbankgröße, größte Tabellen, Upload-Volumen und
              Connector-Erreichbarkeit auf einen Blick — praktisch auf dem eigenen Host.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "Aktualisiere…" : "Aktualisieren"}
          </Button>
        </div>
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        <p className={cn("inline-flex items-center gap-2 font-semibold", LIGHT_TEXT_CLASS[metrics.light])}>
          <span className={cn("inline-block size-2 flex-none rounded-full", LIGHT_DOT_CLASS[metrics.light])} aria-hidden />
          {LIGHT_LABEL[metrics.light]}
        </p>
      </header>

      {history.length > 1 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Verlauf (Session)</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((entry) => (
              <li key={entry.checkedAt} className="flex flex-wrap items-center gap-2">
                <span
                  className={cn("inline-block size-2 flex-none rounded-full", LIGHT_DOT_CLASS[entry.light])}
                  aria-hidden
                />
                <span>{new Date(entry.checkedAt).toLocaleString("de-DE")}</span>
                <span className="text-muted-foreground">
                  {LIGHT_LABEL[entry.light]} · DB {entry.dbSizeLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Kennzahlen</h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            Datenbankgröße: <strong>{metrics.dbSizeLabel}</strong>
            {metrics.dbSizeBytes == null ? " (nicht ermittelbar — evtl. PostgreSQL)" : ""}
          </li>
          <li>
            Uploads: <strong>{metrics.uploads.count}</strong> Dateien ·{" "}
            <strong>{metrics.uploads.totalLabel}</strong>
          </li>
          <li>
            Migrationen: <strong>{metrics.migrationsOk ? "aktuell" : "unvollständig"}</strong>
            {metrics.pendingMigrations > 0 ? (
              <>
                {" "}
                ({metrics.pendingMigrations} offen —{" "}
                <Link href="/admin/migrations" className="text-primary hover:underline">
                  Inspector →
                </Link>
                )
              </>
            ) : null}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            RTX / Lokale KI:{" "}
            {rtxDisplay ? (
              <>
                <RtxStatusBadge state={rtxDisplay.connectorState} />
                <span className="text-muted-foreground">
                  ({rtxReadinessSourceLabelDe(rtxDisplay.status)}
                  {metrics.connector.count > 0
                    ? ` · ${metrics.connector.count} Connector online`
                    : ""}
                  )
                </span>
              </>
            ) : (
              <strong>
                {metrics.connector.online ? `${metrics.connector.count} online` : "offline"}
              </strong>
            )}{" "}
            <Link href="/system/rtx-connector" className="text-primary hover:underline">
              RTX Connector →
            </Link>
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Größte Tabellen</h2>
        {metrics.largestTables.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine nennenswerten Daten.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {metrics.largestTables.map((table) => (
              <li key={table.label} className="flex items-center gap-2">
                <span className="w-36">{table.label}</span>
                <span
                  aria-hidden
                  className="inline-block h-2.5 rounded-sm bg-primary"
                  style={{ width: `${Math.round((table.count / maxCount) * 60) + 2}%` }}
                />
                <strong>{table.count.toLocaleString("de-DE")}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Weitere Betriebsansichten:{" "}
        <Link href="/admin/status" className="text-primary hover:underline">
          System-Status
        </Link>{" "}
        ·{" "}
        <Link href="/system/startklar" className="text-primary hover:underline">
          Startklar
        </Link>
        .
      </p>
    </div>
  );
}
