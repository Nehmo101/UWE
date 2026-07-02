import Link from "next/link";
import {
  HealthBadge,
} from "@uwe/shared-ui";
import { prisma, UWE_VERSION } from "@uwe/database/server";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { formatStudioDateTime } from "@/src/lib/format";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { SystemHubBanner } from "@/components/SystemHubBanner";

function overallLevel(ok: boolean): StatusLevel {
  return ok ? "ok" : "error";
}

function studioSecurityLevel(
  studioSecurity: Awaited<ReturnType<typeof getAdminDashboardStatus>>["studioSecurity"],
): StatusLevel {
  if (studioSecurity.severity === "ok") {
    return studioSecurity.level === "local_only" ? "ok" : "ok";
  }
  if (studioSecurity.severity === "warning") {
    return "degraded";
  }
  return "error";
}

function rtxExposureLevel(
  rtxExposure: Awaited<ReturnType<typeof getAdminDashboardStatus>>["rtxExposure"],
): StatusLevel {
  if (rtxExposure.ok) {
    return "ok";
  }
  return rtxExposure.severity === "warning" ? "degraded" : "error";
}

function rtxLevel(rtx: Awaited<ReturnType<typeof getAdminDashboardStatus>>["rtx"]): StatusLevel {
  if (!rtx.urlAllowed) {
    return "error";
  }
  if (rtx.agentStatus === "disabled") {
    return "disabled";
  }
  if (rtx.agentStatus === "starting") {
    return "degraded";
  }
  if (rtx.ready) {
    return "ok";
  }
  if (rtx.agentStatus === "error" || rtx.agentStatus === "unreachable") {
    return "error";
  }
  if (!rtx.online) {
    return "error";
  }
  return "ok";
}

function rtxStatusLabel(rtx: Awaited<ReturnType<typeof getAdminDashboardStatus>>["rtx"]): string {
  if (rtx.agentStatus === "disabled") return "Deaktiviert";
  if (rtx.agentStatus === "starting") return "Startet";
  if (rtx.ready) return "Bereit";
  if (rtx.agentStatus === "error") return "Fehler";
  if (rtx.agentStatus === "unreachable") return "Nicht erreichbar";
  return rtx.online ? "Online" : "Offline";
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

  const { system, inference, rtx, mail, brain, embeddings, aiRuns, jobs, auth, studioSecurity, rtxExposure, envValidation, publicLeaks } =
    status;

  const overallBadge = status.ok ? "ok" : "degraded";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Dashboard", href: "/studio" }, { label: "Systemstatus" }]}
        />
      }
    >
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
      <SystemHubBanner />
          <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
            Stand: {formatStudioDateTime(new Date(status.timestamp))} · UWE {UWE_VERSION}
            {system.commit ? ` · ${system.commit.slice(0, 7)}` : ""}
          </p>

          <div className="uwe-dashboard-grid">
            <StatusCard
              title="Public Leak Scanner"
              level={publicLeaks.criticalCount > 0 ? "error" : publicLeaks.warningCount > 0 ? "degraded" : "ok"}
              statusLabel={
                publicLeaks.findingCount === 0
                  ? "Keine Befunde"
                  : `${publicLeaks.criticalCount} kritisch, ${publicLeaks.warningCount} Warnungen`
              }
              message={
                publicLeaks.findingCount === 0
                  ? "Keine verdächtigen Portal-Leaks in published/player_visible Inhalten gefunden."
                  : `${publicLeaks.findingCount} potenzielle Leak-Befunde — prüfe Sichtbarkeiten und Block-Typen.`
              }
              details={publicLeaks.findings.slice(0, 8).map((finding) => ({
                label: finding.targetLabel,
                value: `${finding.severity}: ${finding.message}`,
              }))}
              nextSteps={
                publicLeaks.findingCount > 0
                  ? [
                      "Öffne den World Inspector und prüfe player_visible Inhalte.",
                      "JSON-API: /api/admin/security/leaks",
                    ]
                  : []
              }
              wide
            />

            <StatusCard
              title="Env Validation"
              level={
                envValidation.some((issue) => issue.severity === "error")
                  ? "error"
                  : envValidation.some((issue) => issue.severity === "warning")
                    ? "degraded"
                    : "ok"
              }
              statusLabel={
                envValidation.length === 0 ? "OK" : `${envValidation.length} Hinweise`
              }
              message={
                envValidation.length === 0
                  ? "Keine Umgebungsprobleme erkannt."
                  : "Prüfe .env — Details ohne Secret-Werte."
              }
              details={envValidation.map((issue) => ({
                label: issue.envKey ?? issue.id,
                value: `${issue.severity}: ${issue.message}`,
              }))}
              nextSteps={
                envValidation.some((issue) => issue.severity === "error")
                  ? ["Behebe kritische .env-Einträge vor öffentlicher Exposition."]
                  : []
              }
              wide
            />

            <StatusCard
              title="Studio Security"
              level={studioSecurityLevel(studioSecurity)}
              statusLabel={studioSecurity.label}
              message={studioSecurity.message}
              details={[
                { label: "Öffentliche Exposition", value: studioSecurity.publicExposureConfigured },
                { label: "TRUST_PROXY", value: studioSecurity.proxyIndicators.trustProxy },
                { label: "CLOUDFLARE_TUNNEL", value: studioSecurity.proxyIndicators.cloudflareTunnel },
                {
                  label: "Netzwerk-Schutz (Heuristik)",
                  value: studioSecurity.proxyIndicators.networkProtectionLikely,
                },
                { label: "Public Base URL", value: system.proxy.publicAppUrl ?? "—" },
                { label: "Studio URL", value: system.proxy.studioUrl ?? "—" },
                { label: "Portal URL", value: system.proxy.portalUrl ?? "—" },
                { label: "Deployment", value: system.proxy.deploymentModel },
                ...(system.proxy.deploymentModel === "unified-path"
                  ? [
                      { label: "Studio-Pfad", value: system.proxy.studioPath },
                      { label: "Portal-Pfad", value: system.proxy.portalPath },
                    ]
                  : []),
                { label: "Tunnel konfiguriert", value: system.proxy.cloudflare.tunnelConfigured },
                {
                  label: "Studio eigener Host",
                  value: system.proxy.cloudflare.studioOnSeparateHost,
                },
                { label: "STUDIO_API_TOKEN", value: studioSecurity.checks.studioApiTokenConfigured },
                { label: "Portal AUTH_REQUIRED", value: studioSecurity.checks.portalAuthRequired },
                { label: "AUTH_SECRET schwach", value: studioSecurity.checks.authSecretLooksWeak },
                { label: "RUN_DB_SEED=false", value: studioSecurity.checks.runDbSeedDisabled },
                { label: "Cookie Secure", value: studioSecurity.checks.sessionCookieSecure },
              ]}
              nextSteps={studioSecurity.nextSteps}
              wide
            />

            <StatusCard
              title="RTX Exposure"
              level={rtxExposureLevel(rtxExposure)}
              statusLabel={rtxExposure.ok ? "Privates Netz" : "Öffentlich blockiert"}
              message={rtxExposure.message}
              details={rtxExposure.endpoints
                .filter((endpoint) => endpoint.configured)
                .map((endpoint) => ({
                  label: endpoint.envKey,
                  value: `${endpoint.endpointLabel} (${endpoint.urlKind}${endpoint.privateNetworkOk ? ", OK" : ", blockiert"})`,
                }))}
              nextSteps={rtxExposure.nextSteps}
            />

            <StatusCard
              title="UWE App"
              level={overallLevel(system.app.ok && system.database.ok)}
              statusLabel={system.database.ok ? "Online" : "Fehler"}
              message={system.database.message}
              details={[
                { label: "Umgebung", value: system.app.nodeEnv },
                { label: "Production", value: system.app.production },
                { label: "Version", value: system.version },
                {
                  label: "Migrationen",
                  value: system.migrations.ok ? "OK" : "Ausstehend",
                },
              ]}
              nextSteps={
                system.migrations.ok
                  ? []
                  : [
                      "Führe Datenbank-Migrationen aus (pnpm db:deploy).",
                      "Details: /admin/migrations",
                    ]
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
              title="RTX / Lokale KI"
              level={rtxLevel(rtx)}
              statusLabel={rtxStatusLabel(rtx)}
              message={
                !rtx.urlAllowed && rtx.publicExposureWarning
                  ? rtx.publicExposureWarning
                  : rtx.message
              }
              details={[
                { label: "Quelle", value: rtx.source === "agent" ? "RTX-Agent" : "Direkt (Inference)" },
                { label: "Agent-Status", value: rtx.agentStatus ?? "—" },
                { label: "Endpoint", value: rtx.endpoint },
                { label: "URL erlaubt", value: rtx.urlAllowed },
                { label: "URL-Typ", value: rtx.urlKind },
                { label: "Standardmodell", value: rtx.defaultModel },
                { label: "Inference aktiv", value: inference.enabled },
                { label: "Inference online", value: inference.online },
              ]}
              nextSteps={
                !rtx.urlAllowed
                  ? [
                      rtx.publicExposureWarning ??
                        "RTX-/Inference-URL ist öffentlich — private Heimnetz-IP verwenden.",
                      "Keinen Cloudflare-Tunnel direkt zum RTX-Agent legen.",
                      "AI_INFERENCE_ALLOW_PUBLIC_URL=true nur bewusst für Tests setzen.",
                    ]
                  : !rtx.ready && inference.enabled
                    ? [
                        rtx.source === "agent"
                          ? "Prüfe UWE RTX-Agent auf dem RTX-Rechner (Tray, Token, Ollama)."
                          : "Prüfe, ob Ollama/LM Studio auf dem RTX-Rechner läuft.",
                        "Prüfe RTX_AGENT_URL oder AI_INFERENCE_BASE_URL (private Heimnetz-IP).",
                        "Brain-/Objekt-KI blockiert bei RTX offline — Allgemeiner Cloud-Chat bleibt möglich.",
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
            <section className="uwe-v2-card" style={{ marginTop: "1rem" }}>
              <h2 className="uwe-v2-section-title">Letzte fehlgeschlagene Jobs</h2>
              <ul className="uwe-dashboard-list">
                {jobs.recentFailures.map((job) => (
                  <li key={job.id}>
                    <strong>{job.title}</strong> · {job.type}
                    <p>
                      {formatStudioDateTime(new Date(job.createdAt))}
                      {job.errorMessage ? `\n${job.errorMessage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {aiRuns.recentFailures.length > 0 && (
            <section className="uwe-v2-card" style={{ marginTop: "1rem" }}>
              <h2 className="uwe-v2-section-title">Letzte fehlgeschlagene AI Runs</h2>
              <ul className="uwe-dashboard-list">
                {aiRuns.recentFailures.map((run) => (
                  <li key={run.id}>
                    <strong>{run.taskType}</strong> · {run.provider}/{run.model}
                    <p>
                      {formatStudioDateTime(new Date(run.createdAt))}
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
    </SystemShell>
  );
}
