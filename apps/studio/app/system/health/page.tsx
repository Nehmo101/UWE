import Link from "next/link";
import { prisma } from "@uwe/database/server";
import { createHealthMetricsService, type HealthLight } from "@uwe/database/health-metrics";
import { RtxStatusBadge } from "@uwe/shared-ui";
import { requireStudioAccess } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { BuildVersionFooter } from "@/src/components/system/BuildVersion";
import { getBuildInfo } from "@/src/lib/build-info";
import {
  loadStudioRtxDisplayState,
  rtxReadinessSourceLabelDe,
} from "@/src/lib/rtx-display-state";

export const dynamic = "force-dynamic";

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

export default async function SystemHealthPage() {
  await requireStudioAccess();
  const info = getBuildInfo();
  const [metrics, rtxDisplay] = await Promise.all([
    createHealthMetricsService(prisma).getMetrics(),
    loadStudioRtxDisplayState(prisma).catch(() => null),
  ]);
  const maxCount = Math.max(1, ...metrics.largestTables.map((t) => t.count));

  return (
    <SystemShell
      breadcrumb={<span>System / Health</span>}
      footer={<BuildVersionFooter info={info} />}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Health-Ampel</h1>
          <p className="text-sm text-muted-foreground">
            Was macht UWE langsam? Datenbankgröße, größte Tabellen, Upload-Volumen und
            Connector-Erreichbarkeit auf einen Blick — praktisch auf dem eigenen Host.
          </p>
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
              Migrationen:{" "}
              <strong>{metrics.migrationsOk ? "aktuell" : "unvollständig"}</strong>
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
    </SystemShell>
  );
}
