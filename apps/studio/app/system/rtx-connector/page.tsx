import Link from "next/link";

import { CONNECTOR_OFFLINE_MESSAGE } from "@uwe/connector";
import { createConnectorService, prisma } from "@uwe/database/server";
import { HealthBadge } from "@uwe/shared-ui";

import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";
import { RtxConnectorClient } from "./RtxConnectorClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function RtxConnectorPage({ searchParams }: PageProps) {
  const { from } = await searchParams;
  const service = createConnectorService(prisma);
  const [summary, pendingByLane] = await Promise.all([
    service.summarize(),
    service.countPendingByLane(),
  ]);
  const hostConfig = resolveHostConnectorConfig();

  const badge = summary.anyOnline ? "ok" : "degraded";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Heute", href: "/today" },
            { label: "System", href: "/system" },
            { label: "RTX Connector" },
          ]}
        />
      }
    >
      <PageHeader
        title="RTX Connector"
        summary="Optionaler lokaler Worker für KI, Audio und Spotify. UWE bleibt ohne Connector vollständig online."
        actions={
          <HealthBadge
            status={badge}
            label={summary.anyOnline ? `${summary.onlineCount} online` : "Connector offline"}
          />
        }
      />
      {from === "cookbook" && (
        <section className="uwe-v2-section" role="status">
          <div className="uwe-v2-card" style={{ padding: "1rem", borderColor: "var(--uwe-accent, #888)" }}>
            <strong>Das Cookbook ist umgezogen.</strong>
            <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
              Lokales Modell-Management läuft jetzt über den RTX Connector: aktivierte Modelle werden
              vom Connector gemeldet, Workflow-Standards stellst du hier ein. Online-/Cloud-KI bleibt
              in den <Link href="/settings">Einstellungen</Link> und im{" "}
              <Link href="/admin/ai-gateway">AI Gateway</Link>.
            </p>
          </div>
        </section>
      )}

      {!summary.anyOnline && (
        <section className="uwe-v2-section" role="status">
          <div className="uwe-v2-card" style={{ padding: "1rem" }}>
            <strong>{CONNECTOR_OFFLINE_MESSAGE}</strong>
            <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
              Das ist ein normaler Zustand. Website, Studio und Portal laufen unabhängig vom RTX
              Connector. Sobald der Connector startet, werden lokale Funktionen automatisch aktiv.
            </p>
          </div>
        </section>
      )}

      <RtxConnectorClient
        initialSummary={summary}
        initialPendingByLane={pendingByLane}
        hostQueueEnabled={hostConfig.queueEnabled}
        cloudFallbackAllowed={hostConfig.cloudFallbackAllowed}
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Privacy-Guard</h2>
        <ul className="uwe-dashboard-muted" style={{ margin: 0, paddingLeft: "1.1rem" }}>
          <li>
            <strong>Life Brain:</strong> strikt lokal über RTX — kein Cloud-Fallback, nicht
            konfigurierbar.
          </li>
          <li>
            <strong>Cloud-AI Fallback:</strong>{" "}
            {hostConfig.cloudFallbackAllowed
              ? "erlaubt, wenn lokale Modelle offline sind"
              : "deaktiviert — nur RTX/Connector"}
          </li>
          <li>
            <strong>Connector-Warteschlange:</strong>{" "}
            {hostConfig.queueEnabled ? "aktiv" : "pausiert (UWE_HOST_QUEUE_DISABLED)"}
          </li>
          <li>
            <strong>DnD/Welt-Kontext:</strong> Cloud nur wenn{" "}
            <Link href="/admin/ai-gateway">AI-Gateway-Policy</Link> es erlaubt (Standard: RTX
            bevorzugt).
          </li>
        </ul>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Einrichtung</h2>
        <ol className="uwe-homelab-checklist">
          <li>
            <strong>Token erzeugen</strong>
            <span>Oben „Connector hinzufügen“ — das Token wird nur einmal angezeigt.</span>
          </li>
          <li>
            <strong>Auf dem RTX-PC</strong>
            <span>
              Repo + <code>pnpm install</code>, dann{" "}
              <code>cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env</code>,
              <code>UWE_HOST_URL</code> und <code>UWE_CONNECTOR_TOKEN</code> eintragen.
            </span>
          </li>
          <li>
            <strong>Starten</strong>
            <span>
              <code>pnpm connector:start</code> — der Connector verbindet sich ausgehend zum Host.
            </span>
          </li>
        </ol>
        <p className="uwe-dashboard-muted" style={{ marginTop: "0.75rem" }}>
          Details: <Link href="/system">System-Übersicht →</Link> · Doku{" "}
          <code>docs/rtx-connector.md</code> und <code>docs/connector-security.md</code>.
        </p>
      </section>
    </SystemShell>
  );
}
