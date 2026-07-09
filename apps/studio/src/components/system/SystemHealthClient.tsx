"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { HealthLight, HealthMetrics } from "@uwe/database/health-metrics";
import { RtxStatusBadge } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  rtxReadinessSourceLabelDe,
  loadStudioRtxDisplayState,
} from "@/src/lib/rtx-display-state";

type StudioRtxDisplayState = Awaited<ReturnType<typeof loadStudioRtxDisplayState>>;

const LIGHT_LABEL: Record<HealthLight, string> = {
  green: "Grün — alles im grünen Bereich",
  yellow: "Gelb — beobachten",
  red: "Rot — Handlungsbedarf",
};

const LIGHT_COLOR: Record<HealthLight, string> = {
  green: "#2e7d32",
  yellow: "#b7791f",
  red: "#c62828",
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
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Aktualisiere…" : "Aktualisieren"}
          </button>
        </div>
        {error ? <p className="uwe-form-error">{error}</p> : null}
        <p
          style={{
            color: LIGHT_COLOR[metrics.light],
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
          }}
        >
          <span
            className={`uwe-dot ${
              metrics.light === "green"
                ? "uwe-dot-success"
                : metrics.light === "yellow"
                  ? "uwe-dot-warning"
                  : "uwe-dot-danger"
            }`}
            aria-hidden
          />
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
                  className={`uwe-dot ${
                    entry.light === "green"
                      ? "uwe-dot-success"
                      : entry.light === "yellow"
                        ? "uwe-dot-warning"
                        : "uwe-dot-danger"
                  }`}
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
          <li style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem" }}>
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
              <li key={table.label} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ width: "9rem" }}>{table.label}</span>
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    height: "0.6rem",
                    width: `${Math.round((table.count / maxCount) * 60) + 2}%`,
                    background: "var(--uwe-accent, #6b7280)",
                    borderRadius: "3px",
                  }}
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
