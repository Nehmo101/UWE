import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  HealthBadge,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { prisma, UWE_VERSION } from "@uwe/database/server";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function overallLevel(ok: boolean): StatusLevel {
  return ok ? "ok" : "error";
}

function inferenceLevel(inference: Awaited<ReturnType<typeof getAdminDashboardStatus>>["inference"]): StatusLevel {
  if (!inference.enabled) {
    return "disabled";
  }
  if (!inference.configured) {
    return "error";
  }
  if (!inference.online) {
    return "error";
  }
  return "ok";
}

function mailLevel(mail: Awaited<ReturnType<typeof getAdminDashboardStatus>>["mail"]): StatusLevel {
  if (!mail.enabled) {
    return "disabled";
  }
  return mail.ok ? "ok" : "error";
}

function embeddingLevel(
  embeddings: Awaited<ReturnType<typeof getAdminDashboardStatus>>["embeddings"],
): StatusLevel {
  if (!embeddings.enabled) {
    return "disabled";
  }
  return embeddings.ok ? "ok" : "error";
}

function aiRunLevel(aiRuns: Awaited<ReturnType<typeof getAdminDashboardStatus>>["aiRuns"]): StatusLevel {
  if (aiRuns.failedCount > 0) {
    return "degraded";
  }
  if (aiRuns.runningCount > 0) {
    return "degraded";
  }
  return "ok";
}

export default async function AdminStatusPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const status = await getAdminDashboardStatus(prisma, {
    rateLimiterMode: "none (Studio: vertrauenswürdiges Netz)",
    useMockInference,
  });

  const { system, inference, mail, brain, embeddings, aiRuns, jobs, auth } = status;

  const overallBadge = status.ok ? "ok" : "degraded";

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Systemstatus" href="/" />}
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Systemstatus", href: "/admin/status", active: true },
                { label: "Einstellungen", href: "/settings" },
                { label: "Backup", href: "/backup" },
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Systemstatus" },
            ]}
          />

          <PageHeader
            title="Admin Status Dashboard"
            summary="Diagnose für UWE, Datenbank, Storage, Cloudflare, Auth, Mail, Brain, RTX-Inference und Jobs — ohne Secrets."
            actions={
              <HealthBadge
                status={overallBadge}
                label={status.ok ? "System OK" : "Einschränkungen"}
              />
            }
          />

          <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
            Stand: {DATE_FORMAT.format(new Date(status.timestamp))} · UWE {UWE_VERSION}
            {system.commit ? ` · ${system.commit.slice(0, 7)}` : ""}
          </p>

          <div className="uwe-dashboard-grid">
            <StatusCard
              title="UWE App"
              level={overallLevel(system.app.ok && system.database.ok)}
              statusLabel={system.database.ok ? "Online" : "Fehler"}
              message={system.database.message}
              details={[
                { label: "Umgebung", value: system.app.nodeEnv },
                { label: "Production", value: system.app.production },
                { label: "Version", value: system.version },
                { label: "Migrationen", value: system.migrations.ok ? "OK" : "Ausstehend" },
              ]}
              nextSteps={
                system.migrations.ok
                  ? []
                  : ["Führe Datenbank-Migrationen aus (pnpm db:deploy)."]
              }
            />

            <StatusCard
              title="Storage"
              level={overallLevel(system.storage.ok)}
              statusLabel={system.storage.ok ? "OK" : "Fehler"}
              message={system.storage.message}
              details={[
                { label: "Uploads", value: system.storage.uploadsWritable },
                { label: "Backups", value: system.storage.backupsWritable },
                { label: "Exports", value: system.storage.exportsWritable },
                { label: "DB-Datei", value: system.storage.databaseFileExists ?? "n/a" },
              ]}
              nextSteps={
                system.storage.ok
                  ? []
                  : ["Prüfe Schreibrechte für UWE_DATA_DIR / Upload-, Backup- und Export-Pfade."]
              }
            />

            <StatusCard
              title="Cloudflare / Proxy"
              level={
                system.proxy.publicExposureConfigured && !system.proxy.trustProxy
                  ? "degraded"
                  : "ok"
              }
              statusLabel={
                system.proxy.cloudflareTunnel
                  ? "Tunnel aktiv"
                  : system.proxy.publicExposureConfigured
                    ? "Öffentlich"
                    : "Lokal"
              }
              message={
                system.proxy.cloudflareTunnel
                  ? "Cloudflare Tunnel ist konfiguriert."
                  : system.proxy.publicAppUrl
                    ? `Öffentliche URL: ${system.proxy.publicAppUrl}`
                    : "Keine öffentliche URL konfiguriert — UWE nur lokal erreichbar."
              }
              details={[
                { label: "PUBLIC_APP_URL", value: system.proxy.publicAppUrl },
                { label: "TRUST_PROXY", value: system.proxy.trustProxy },
                { label: "CLOUDFLARE_TUNNEL", value: system.proxy.cloudflareTunnel },
                { label: "Cookie Secure", value: system.proxy.sessionCookieSecure },
              ]}
              nextSteps={
                system.proxy.publicExposureConfigured && !system.proxy.trustProxy
                  ? ["Setze TRUST_PROXY=true hinter Cloudflare oder Reverse-Proxy."]
                  : []
              }
            />

            <StatusCard
              title="Auth"
              level={auth.ok ? "ok" : "degraded"}
              statusLabel={auth.portalAuthRequired ? "Portal aktiv" : "Optional"}
              message={auth.message}
              details={[
                { label: "Portal AUTH_REQUIRED", value: auth.portalAuthRequired },
                { label: "AUTH_SECRET gesetzt", value: auth.authSecretConfigured },
                { label: "Secret schwach", value: auth.authSecretLooksWeak },
                { label: "Studio API Token", value: auth.studioApiTokenConfigured },
                { label: "Player Preview öffentlich", value: system.proxy.playerPreviewPublic },
              ]}
              nextSteps={auth.nextSteps}
            />

            <StatusCard
              title="Mail (SMTP)"
              level={mailLevel(mail)}
              statusLabel={
                !mail.enabled ? "Deaktiviert" : mail.ok ? "Konfiguriert" : "Fehler"
              }
              message={mail.message}
              details={[
                { label: "MAIL_ENABLED", value: mail.enabled },
                { label: "SMTP Host", value: mail.host },
                { label: "Port", value: mail.port },
                { label: "TLS/SSL", value: mail.secure },
                { label: "SMTP User gesetzt", value: mail.userConfigured },
                { label: "Passwort gesetzt", value: mail.passwordConfigured },
                { label: "Absender", value: mail.fromAddress },
                { label: "Mock-Modus", value: mail.useMock },
                { label: "Fehler in Logs", value: mail.failedLogCount },
              ]}
              nextSteps={mail.nextSteps}
            />

            <StatusCard
              title="Brain Knowledge Store"
              level={overallLevel(brain.ok)}
              statusLabel={brain.enabled ? "Aktiv" : "Deaktiviert"}
              message={brain.message}
              details={[
                { label: "BRAIN_ENABLED", value: brain.enabled },
                { label: "Speicher", value: brain.storage },
                { label: "Dokumente", value: brain.documentCount },
                { label: "Fakten", value: brain.factCount },
                { label: "Chunks", value: brain.chunkCount },
                { label: "Mit Embedding", value: brain.embeddedChunkCount },
              ]}
              nextSteps={brain.nextSteps}
            />

            <StatusCard
              title="RTX Inference"
              level={inferenceLevel(inference)}
              statusLabel={
                !inference.enabled
                  ? "Deaktiviert"
                  : !inference.online
                    ? "Offline"
                    : "Online"
              }
              message={
                !inference.enabled
                  ? inference.message
                  : !inference.online
                    ? inference.offlineReason ?? inference.message
                    : inference.message
              }
              details={[
                { label: "Provider", value: inference.provider },
                { label: "Endpoint", value: inference.endpoint },
                { label: "Standardmodell", value: inference.defaultModel },
                { label: "Timeout (s)", value: inference.timeoutSeconds },
                { label: "Modelle", value: inference.modelCount ?? "—" },
                { label: "URL erlaubt", value: inference.urlAllowed },
              ]}
              nextSteps={
                !inference.online && inference.enabled
                  ? [
                      "Prüfe, ob Ollama/LM Studio auf dem RTX-Rechner läuft.",
                      "Prüfe AI_INFERENCE_BASE_URL (private Heimnetz-IP, z. B. 192.168.x.x).",
                      "UWE bleibt nutzbar — KI-Aktionen zeigen „Brain offline“.",
                    ]
                  : []
              }
              wide
            />

            <StatusCard
              title="Embeddings"
              level={embeddingLevel(embeddings)}
              statusLabel={
                !embeddings.enabled ? "Deaktiviert" : embeddings.ok ? "OK" : "Offline/Fehler"
              }
              message={embeddings.message}
              details={[
                { label: "BRAIN_EMBEDDINGS_ENABLED", value: embeddings.enabled },
                { label: "Provider", value: embeddings.provider },
                { label: "Modell", value: embeddings.model },
                { label: "Endpoint", value: embeddings.endpoint },
                { label: "Speicher", value: embeddings.storeLocation },
                { label: "Indexiert", value: embeddings.indexedChunks },
                { label: "Gesamt Chunks", value: embeddings.totalChunks },
                {
                  label: "Abdeckung",
                  value:
                    embeddings.coveragePercent != null
                      ? `${embeddings.coveragePercent}%`
                      : null,
                },
              ]}
              nextSteps={embeddings.nextSteps}
            />

            <StatusCard
              title="AI Runs"
              level={aiRunLevel(aiRuns)}
              statusLabel={
                aiRuns.failedCount > 0
                  ? `${aiRuns.failedCount} fehlgeschlagen`
                  : aiRuns.totalRuns > 0
                    ? "OK"
                    : "Leer"
              }
              message={aiRuns.message}
              details={[
                { label: "Gesamt", value: aiRuns.totalRuns },
                { label: "Ausstehend", value: aiRuns.pendingCount },
                { label: "Laufend", value: aiRuns.runningCount },
                { label: "Fehlgeschlagen", value: aiRuns.failedCount },
                { label: "Offene Vorschläge", value: aiRuns.openProposalsCount },
                {
                  label: "Letzter Run",
                  value: aiRuns.lastRun
                    ? `${aiRuns.lastRun.taskType} (${aiRuns.lastRun.status})`
                    : null,
                },
              ]}
              nextSteps={aiRuns.nextSteps}
            />

            <StatusCard
              title="Jobs"
              level={jobs.failedCount > 0 ? "degraded" : "ok"}
              statusLabel={jobs.queueImplemented ? "Queue aktiv" : "Nicht verfügbar"}
              message={jobs.message}
              details={[
                { label: "Wartend", value: jobs.pendingCount },
                { label: "Laufend", value: jobs.runningCount },
                { label: "Fehlgeschlagen", value: jobs.failedCount },
                { label: "Abgeschlossen", value: jobs.completedCount },
              ]}
              nextSteps={jobs.nextSteps}
            />
          </div>

          {jobs.recentFailures.length > 0 && (
            <section className="uwe-card" style={{ marginTop: "1rem" }}>
              <h2 className="uwe-section-title">Letzte fehlgeschlagene Jobs</h2>
              <ul className="uwe-dashboard-list">
                {jobs.recentFailures.map((job) => (
                  <li key={job.id}>
                    <strong>{job.title}</strong> · {job.type}
                    <p>
                      {DATE_FORMAT.format(new Date(job.createdAt))}
                      {job.errorMessage ? `\n${job.errorMessage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {aiRuns.recentFailures.length > 0 && (
            <section className="uwe-card" style={{ marginTop: "1rem" }}>
              <h2 className="uwe-section-title">Letzte fehlgeschlagene AI Runs</h2>
              <ul className="uwe-dashboard-list">
                {aiRuns.recentFailures.map((run) => (
                  <li key={run.id}>
                    <strong>{run.taskType}</strong> · {run.provider}/{run.model}
                    <p>
                      {DATE_FORMAT.format(new Date(run.createdAt))}
                      {run.errorMessage ? `\n${run.errorMessage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="uwe-dashboard-muted" style={{ marginTop: "1.5rem" }}>
            Diese Seite ist nur im geschützten Studio verfügbar. Es werden keine Passwörter,
            API-Keys oder Tokens angezeigt. JSON-API:{" "}
            <Link href="/api/admin/status">/api/admin/status</Link>
          </p>
        </>
      }
    />
  );
}
