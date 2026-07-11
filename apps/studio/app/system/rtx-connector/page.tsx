import Link from "next/link";

import { CONNECTOR_OFFLINE_MESSAGE } from "@uwe/connector";
import { createConnectorService, prisma } from "@uwe/database/server";
import { HealthBadge } from "@uwe/shared-ui";

import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { resolveHostConnectorConfig } from "@/src/lib/connector-config";
import { Alert } from "@/src/components/ui";
import { RtxConnectorClient } from "./RtxConnectorClient";
import { RtxInferenceTestPanel } from "./RtxInferenceTestPanel";

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
        <Alert tone="info" icon="book-open" title="Das Cookbook ist umgezogen." className="mb-4">
          Lokales Modell-Management läuft jetzt über den RTX Connector: aktivierte Modelle werden
          vom Connector gemeldet, Workflow-Standards stellst du hier ein. Online-/Cloud-KI bleibt
          in den <Link href="/settings">Einstellungen</Link> und im{" "}
          <Link href="/admin/ai-gateway">AI Gateway</Link>.
        </Alert>
      )}

      {!summary.anyOnline && (
        <Alert tone="info" icon="server-off" title={CONNECTOR_OFFLINE_MESSAGE} className="mb-4">
          Das ist ein normaler Zustand. Website, Studio und Portal laufen unabhängig vom RTX
          Connector. Sobald der Connector startet, werden lokale Funktionen automatisch aktiv.
        </Alert>
      )}

      <RtxConnectorClient
        initialSummary={summary}
        initialPendingByLane={pendingByLane}
        hostQueueEnabled={hostConfig.queueEnabled}
        cloudFallbackAllowed={hostConfig.cloudFallbackAllowed}
      />

      <RtxInferenceTestPanel useMock={process.env.AI_USE_MOCK === "true"} />

      <section className="mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Privacy-Guard</h2>
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
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

      <section className="mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Einrichtung</h2>
        <ol className="grid gap-2">
          <li className="rounded-[var(--radius)] border border-border p-3 text-sm">
            <strong className="block">Token erzeugen</strong>
            <span className="mt-1 block text-muted-foreground">
              Oben „Connector hinzufügen“ — das Token wird nur einmal angezeigt.
            </span>
          </li>
          <li className="rounded-[var(--radius)] border border-border p-3 text-sm">
            <strong className="block">Auf dem RTX-PC</strong>
            <span className="mt-1 block text-muted-foreground">
              Repo + <code>pnpm install</code>, dann{" "}
              <code>cp tools/uwe-rtx-connector/.env.example tools/uwe-rtx-connector/.env</code>,
              <code>UWE_HOST_URL</code> und <code>UWE_CONNECTOR_TOKEN</code> eintragen.
            </span>
          </li>
          <li className="rounded-[var(--radius)] border border-border p-3 text-sm">
            <strong className="block">Starten</strong>
            <span className="mt-1 block text-muted-foreground">
              <code>pnpm connector:start</code> — der Connector verbindet sich ausgehend zum Host.
            </span>
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Details: <Link href="/system">System-Übersicht →</Link> · Doku{" "}
          <code>docs/rtx-connector.md</code> und <code>docs/connector-security.md</code>.
        </p>
      </section>
    </SystemShell>
  );
}
