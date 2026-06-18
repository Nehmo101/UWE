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
import { prisma } from "@uwe/database/server";
import { listCookbookSetupHints } from "@uwe/cookbook";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { getStudioCookbookDashboard } from "@/src/lib/cookbook-dashboard";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";

function fitLevelLabel(level: string): string {
  switch (level) {
    case "excellent":
      return "Ausgezeichnet";
    case "good":
      return "Gut";
    case "marginal":
      return "Grenzwertig";
    case "poor":
      return "Schwach";
    default:
      return "Nicht geeignet";
  }
}

function runtimeLevel(ok: boolean, localOnly: boolean): StatusLevel {
  if (ok) return "ok";
  return localOnly ? "error" : "degraded";
}

export default async function CookbookAdminPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const dashboard = await getStudioCookbookDashboard(prisma, { useMockInference });
  const setupHints = listCookbookSetupHints();

  const { hardware, runtime, recommendations, installedModels, registry, engines } = dashboard;

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("more")}
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Cookbook" href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/" },
              { label: "Cookbook", href: "/admin/cookbook", active: true },
              { label: "Systemstatus", href: "/admin/status" },
              { label: "KI-Prompt", href: "/admin/ai-prompt" },
              { label: "Einstellungen", href: "/settings" },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Cookbook" },
            ]}
          />

          <PageHeader
            title="UWE Cookbook"
            summary="Natives Modell-Management für lokale KI — Hardware-Fit, Runtime-Diagnose und Empfehlungen mit RTX/local-only Datenschutzregeln."
            actions={
              <Link href="/admin/status" className="uwe-button-secondary">
                Systemstatus
              </Link>
            }
          />

          {runtime.warnings.length > 0 && (
            <section className="uwe-form-error uwe-section" role="alert">
              <strong>Datenschutz / Routing:</strong>
              <ul>
                {runtime.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="uwe-dashboard-grid">
            <StatusCard
              title="Hardware-Profil"
              level={hardware.gpuVramGb > 0 || hardware.ramGb > 0 ? "ok" : "degraded"}
              statusLabel={hardware.gpuName ?? "CPU-only"}
              message={hardware.probeMessage}
              details={[
                { label: "Plattform", value: `${hardware.platform} / ${hardware.arch}` },
                { label: "CPU-Kerne", value: hardware.cpuCores },
                { label: "RAM", value: `${hardware.ramGb} GB` },
                { label: "GPU VRAM", value: hardware.gpuVramGb > 0 ? `${hardware.gpuVramGb} GB` : "—" },
                { label: "Backend", value: hardware.backend },
                { label: "Unified Memory", value: hardware.unifiedMemory },
              ]}
            />

            <StatusCard
              title="Lokale Runtime"
              level={runtimeLevel(runtime.ok, runtime.localOnlyMode)}
              statusLabel={runtime.ok ? "Bereit" : "Offline"}
              message={runtime.ollama.message}
              details={[
                { label: "Local-only", value: runtime.localOnlyMode },
                { label: "Ollama", value: runtime.ollama.reachable },
                { label: "Modelle", value: runtime.ollama.modelCount },
                { label: "Docker", value: runtime.docker.running },
                { label: "Endpoint", value: runtime.ollama.endpoint },
              ]}
              nextSteps={runtime.nextSteps}
            />
          </div>

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">Installierte lokale Modelle</h2>
            {installedModels.length === 0 ? (
              <p className="uwe-dashboard-muted">Keine Modelle erkannt. Starte Ollama und lade ein Modell.</p>
            ) : (
              <ul>
                {installedModels.map((model) => (
                  <li key={model}>
                    <code>{model}</code>
                    {registry.some((entry) => entry.ollamaTags.includes(model) || entry.id === model) ? (
                      <span className="uwe-dashboard-muted"> — im Cookbook-Katalog</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">Engine-Status</h2>
            <div className="uwe-dashboard-grid">
              {engines.map((engineDef) => {
                const status = runtime.engines.find((e) => e.engineId === engineDef.id);
                return (
                  <article key={engineDef.id} className="uwe-card uwe-dashboard-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <h3 className="uwe-section-title" style={{ fontSize: "1rem" }}>
                        {engineDef.label}
                      </h3>
                      <HealthBadge
                        status={status?.online ? "ok" : "error"}
                        label={status?.online ? "Online" : "Offline"}
                      />
                    </div>
                    <p className="uwe-dashboard-muted">{engineDef.description}</p>
                    {status?.message ? <p>{status.message}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">Empfehlungen pro Use Case</h2>
            <div className="uwe-dashboard-grid">
              {recommendations.map((rec) => (
                <article key={rec.useCase} className="uwe-card uwe-dashboard-card">
                  <h3 className="uwe-section-title" style={{ fontSize: "1rem" }}>
                    {rec.label}
                  </h3>
                  <p className="uwe-dashboard-muted">{rec.description}</p>
                  <dl
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(7rem, auto) 1fr",
                      gap: "0.25rem 0.75rem",
                      fontSize: "0.85rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <dt style={{ color: "#94a3b8" }}>Modell</dt>
                    <dd style={{ margin: 0 }}>{rec.modelLabel}</dd>
                    <dt style={{ color: "#94a3b8" }}>Engine</dt>
                    <dd style={{ margin: 0 }}>{rec.engineId}</dd>
                    <dt style={{ color: "#94a3b8" }}>Hardware-Fit</dt>
                    <dd style={{ margin: 0 }}>
                      {rec.fit.score}/100 — {fitLevelLabel(rec.fit.level)}
                    </dd>
                    <dt style={{ color: "#94a3b8" }}>VRAM (geschätzt)</dt>
                    <dd style={{ margin: 0 }}>{rec.fit.estimatedVramGb} GB</dd>
                  </dl>
                  <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    {rec.privacyNote}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {runtime.diagnoses.length > 0 && (
            <section className="uwe-card uwe-section">
              <h2 className="uwe-section-title">Runtime-Diagnose</h2>
              {runtime.diagnoses.map((diag) => (
                <article key={diag.summary} style={{ marginBottom: "1rem" }}>
                  <strong>{diag.summary}</strong>
                  <ul>
                    {diag.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          )}

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">Setup: Ollama / Docker / Local Serve</h2>
            {setupHints.map((entry) => (
              <article key={entry.engineId} style={{ marginBottom: "1.25rem" }}>
                <h3 className="uwe-section-title" style={{ fontSize: "1rem" }}>
                  {entry.label}
                </h3>
                <ol>
                  {entry.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ol>
              </article>
            ))}
          </section>

          <section className="uwe-card uwe-section">
            <h2 className="uwe-section-title">Modell-Katalog (Auszug)</h2>
            <table className="uwe-table" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>Modell</th>
                  <th>Parameter</th>
                  <th>Min VRAM (Q4)</th>
                  <th>Use Cases</th>
                </tr>
              </thead>
              <tbody>
                {registry.map((model) => (
                  <tr key={model.id}>
                    <td>{model.label}</td>
                    <td>{model.paramsB}B</td>
                    <td>{model.minVramGbQ4} GB</td>
                    <td>{model.useCases.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      }
    />
  );
}
