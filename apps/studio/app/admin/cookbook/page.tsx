import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { prisma } from "@uwe/database/server";
import { listCookbookSetupHints } from "@uwe/cookbook";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { getStudioCookbookDashboard } from "@/src/lib/cookbook-dashboard";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { Alert, buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
import { CookbookRecommendationsPanel } from "./CookbookRecommendationsPanel";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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
          <Link href="/system/rtx-connector" className={buttonVariants({ variant: "secondary" })}>
            RTX Connector →
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Lokales Modell-Management auf dem Host läuft primär über den{" "}
          <Link href="/system/rtx-connector">RTX Connector</Link>. Diese Seite zeigt Hardware-Fit und
          Empfehlungen aus dem Cookbook-Katalog.
        </p>

        {runtime.warnings.length > 0 && (
          <Alert tone="danger" role="alert" title="Datenschutz / Routing:">
            <ul className="list-disc space-y-1 pl-5">
              {runtime.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Engine-Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {engines.map((engineDef) => {
                const status = runtime.engines.find((e) => e.engineId === engineDef.id);
                return (
                  <Card key={engineDef.id}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <CardTitle className="text-base">{engineDef.label}</CardTitle>
                      <HealthBadge
                        status={status?.online ? "ok" : "error"}
                        label={status?.online ? "Online" : "Offline"}
                      />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{engineDef.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Installierte Modelle</CardTitle>
          </CardHeader>
          <CardContent>
            {installedModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Modelle erkannt.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {installedModels.map((model) => (
                  <li key={model}>
                    <code>{model}</code>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup-Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {setupHints.map((entry) => (
              <div key={entry.engineId}>
                <h3 className="text-base font-semibold tracking-tight">{entry.label}</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {entry.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modell-Katalog (Auszug)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Modell</th>
                    <th className={TH_CLASS}>Use Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.map((model) => (
                    <tr key={model.id}>
                      <td className={TD_CLASS}>{model.label}</td>
                      <td className={TD_CLASS}>{model.useCases.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SystemShell>
  );
}
