import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { prisma } from "@uwe/database/server";
import { listCookbookSetupHints } from "@uwe/cookbook";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { getStudioCookbookDashboard } from "@/src/lib/cookbook-dashboard";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { CookbookRecommendationsPanel } from "./CookbookRecommendationsPanel";

function runtimeLevel(ok: boolean, localOnly: boolean): StatusLevel {
  if (ok) return "ok";
  return localOnly ? "error" : "degraded";
}

export default async function CookbookAdminPage() {
  await requireAdminAccess();

  const useMockInference = process.env.AI_USE_MOCK === "true";
  const dashboard = await getStudioCookbookDashboard(prisma, { useMockInference });
  const setupHints = listCookbookSetupHints();

  const { hardware, runtime, recommendations, installedModels, registry, engines } = dashboard;

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Cookbook" },
          ]}
        />
      }
    >
      <PageHeader
        title="UWE Cookbook"
        summary="Lokale Modell-Empfehlungen nach Use Case — filterbar nach Bereich. RTX-Setup: System → RTX Connector."
        actions={
          <Link href="/system/rtx-connector" className="uwe-v2-btn uwe-v2-btn-secondary">
            RTX Connector →
          </Link>
        }
      />

      <p className="uwe-hint">
        Lokales Modell-Management auf dem Host läuft primär über den{" "}
        <Link href="/system/rtx-connector">RTX Connector</Link>. Diese Seite zeigt Hardware-Fit und
        Empfehlungen aus dem Cookbook-Katalog.
      </p>

      {runtime.warnings.length > 0 && (
        <section className="uwe-form-error uwe-v2-section" role="alert">
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
            { label: "RAM", value: `${hardware.ramGb} GB` },
            { label: "GPU VRAM", value: hardware.gpuVramGb > 0 ? `${hardware.gpuVramGb} GB` : "—" },
            { label: "Backend", value: hardware.backend },
          ]}
        />
        <StatusCard
          title="Lokale Runtime"
          level={runtimeLevel(runtime.ok, runtime.localOnlyMode)}
          statusLabel={runtime.ok ? "Bereit" : "Offline"}
          message={runtime.ollama.message}
          details={[
            { label: "Ollama", value: runtime.ollama.reachable },
            { label: "Modelle", value: runtime.ollama.modelCount },
          ]}
          nextSteps={runtime.nextSteps}
        />
      </div>

      <CookbookRecommendationsPanel recommendations={recommendations} />

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Engine-Status</h2>
        <div className="uwe-dashboard-grid">
          {engines.map((engineDef) => {
            const status = runtime.engines.find((e) => e.engineId === engineDef.id);
            return (
              <article key={engineDef.id} className="uwe-v2-card uwe-dashboard-card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <h3 className="uwe-v2-section-title" style={{ fontSize: "1rem" }}>
                    {engineDef.label}
                  </h3>
                  <HealthBadge
                    status={status?.online ? "ok" : "error"}
                    label={status?.online ? "Online" : "Offline"}
                  />
                </div>
                <p className="uwe-dashboard-muted">{engineDef.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Installierte Modelle</h2>
        {installedModels.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine Modelle erkannt.</p>
        ) : (
          <ul>
            {installedModels.map((model) => (
              <li key={model}>
                <code>{model}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Setup-Hinweise</h2>
        {setupHints.map((entry) => (
          <article key={entry.engineId} style={{ marginBottom: "1rem" }}>
            <h3 className="uwe-v2-section-title" style={{ fontSize: "1rem" }}>
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

      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Modell-Katalog (Auszug)</h2>
        <table className="uwe-table" style={{ width: "100%", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th>Modell</th>
              <th>Use Cases</th>
            </tr>
          </thead>
          <tbody>
            {registry.map((model) => (
              <tr key={model.id}>
                <td>{model.label}</td>
                <td>{model.useCases.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </SystemShell>
  );
}
