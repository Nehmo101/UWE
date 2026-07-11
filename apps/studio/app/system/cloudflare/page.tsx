import { requireOwner } from "@/src/lib/auth";
import { SettingsService, getProxyStatus, prisma } from "@uwe/database/server";
import { applyDeploymentRuntimeOverrides, type DeploymentSettings } from "@uwe/database/deployment";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { CloudflareStatusAutoRefresh } from "@/components/CloudflareStatusAutoRefresh";
import { CloudflareTunnelHealthPanel } from "@/components/CloudflareTunnelHealthPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Alert } from "@/src/components/ui/states";
import { updateDeploymentConfigAction } from "./actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: Promise<{ saved?: string }>;
}

function yesNo(value: boolean): string {
  return value ? "Ja" : "Nein";
}

type Source = "db" | "env";

function stringSource(value: string): Source {
  return value.trim() ? "db" : "env";
}

function overrideSource(value: DeploymentSettings["trustProxy"]): Source {
  return value === "env" ? "env" : "db";
}

export default async function SystemCloudflarePage({ searchParams }: Props) {
  await requireOwner();
  const [settings, params] = await Promise.all([
    new SettingsService(prisma).getSettings(),
    searchParams ?? Promise.resolve({} as { saved?: string }),
  ]);
  const d = settings.deployment;
  // Keep the shared runtime-config overlay in sync with the persisted settings so the
  // effective status below reflects the database even if the boot-time load was skipped.
  applyDeploymentRuntimeOverrides(d);
  const proxy = getProxyStatus();
  const cf = proxy.cloudflare;

  const routing: { label: string; value: string; source: Source }[] = [
    { label: "Deployment-Modell", value: proxy.deploymentModel, source: "env" },
    { label: "Öffentliche App-URL", value: proxy.publicAppUrl ?? "—", source: stringSource(d.publicAppUrl) },
    { label: "Studio-URL", value: proxy.studioUrl ?? "—", source: stringSource(d.studioUrl) },
    { label: "Portal-URL", value: proxy.portalUrl ?? "—", source: stringSource(d.portalUrl) },
    { label: "Studio-Pfad", value: proxy.studioPath, source: stringSource(d.studioPath) },
    { label: "Portal-Pfad", value: proxy.portalPath, source: stringSource(d.portalPath) },
    { label: "Studio auf eigenem Host", value: yesNo(cf.studioOnSeparateHost), source: "env" },
  ];

  const cloudflare: { label: string; value: string; source: Source }[] = [
    { label: "Tunnel konfiguriert", value: yesNo(cf.tunnelConfigured), source: overrideSource(d.cloudflareTunnel) },
    { label: "Trust Proxy", value: yesNo(proxy.trustProxy), source: overrideSource(d.trustProxy) },
    { label: "Public Exposure konfiguriert", value: yesNo(proxy.publicExposureConfigured), source: "env" },
  ];

  const humanCheck: { label: string; value: string; source: Source }[] = [
    {
      label: "„Mensch“-Prüfung (Turnstile) aktiv",
      value: yesNo(cf.humanVerificationEnabled),
      source: overrideSource(d.turnstileEnabled),
    },
    {
      label: "Turnstile-Secret konfiguriert",
      value: yesNo(cf.humanVerificationConfigured),
      source: d.turnstileSecretConfigured ? "db" : "env",
    },
  ];

  const security: { label: string; value: string; source: Source }[] = [
    { label: "Auth erforderlich", value: yesNo(proxy.authRequired), source: overrideSource(d.authRequired) },
    {
      label: "Session-Cookie Secure",
      value: yesNo(proxy.sessionCookieSecure),
      source: overrideSource(d.sessionCookieSecure),
    },
    {
      label: "Player-Preview öffentlich",
      value: yesNo(proxy.playerPreviewPublic),
      source: overrideSource(d.playerPreviewPublic),
    },
  ];

  const healthy = cf.tunnelConfigured && proxy.trustProxy && proxy.authRequired;

  return (
    <SystemShell breadcrumb={<span>System / Cloudflare</span>}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Cloudflare</h1>
          <p className="text-sm text-muted-foreground">
            Routing, Cloudflare-Tunnel, „Ich bin ein Mensch“-Prüfung und Sicherheits-Flags — jetzt
            direkt hier einstellbar. Werte werden in der Datenbank gespeichert; leere Felder bzw.
            „Automatisch“ erben aus der Host-Umgebung (<code>.env</code>). Secrets werden verschlüsselt
            gespeichert und nie angezeigt. Details siehe{" "}
            <code>docs/cloudflare-current-setup.md</code>.
          </p>
        </header>

        {params.saved === "1" && (
          <Alert tone="success" icon="shield-check" title="Gespeichert">
            Die Einstellungen wurden übernommen.
          </Alert>
        )}

        <Alert tone="info" icon="cloud" title="Was sofort greift">
          Server-gerenderte Effekte (Login/Turnstile, Session-Cookie-Flags, Link-Erzeugung,
          Player-Preview) gelten sofort. Die Edge-Middleware liest weiterhin die <code>.env</code> —
          das betrifft das <strong>Auth-Login-Gate</strong>, die <strong>CORS-Host-Prüfung</strong> und
          die <strong>Portal-Pfad-Weiterleitung</strong>. Für diese ändere die Host-Umgebung und starte
          den Dienst neu.
        </Alert>

        {healthy ? (
          <Alert tone="success" icon="shield-check" title="Cloudflare/Proxy konfiguriert">
            Tunnel, Trust-Proxy und Auth sind aktiv.
          </Alert>
        ) : (
          <Alert tone="warning" icon="cloud" title="Konfiguration unvollständig">
            Tunnel, Trust-Proxy oder Auth sind nicht vollständig aktiviert — passe die Werte unten an
            oder prüfe die Host-Umgebung.
          </Alert>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Effektiver Status</h2>
          <CloudflareStatusAutoRefresh />
          <CloudflareTunnelHealthPanel />
          <StatusCard title="Routing" rows={routing} />
          <StatusCard title="Cloudflare" rows={cloudflare} />
          <StatusCard title="„Ich bin ein Mensch“-Prüfung" rows={humanCheck} />
          <StatusCard title="Sicherheit" rows={security} />
        </section>

        <form action={updateDeploymentConfigAction} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Einstellungen bearbeiten</h2>

          <Card>
            <CardHeader>
              <CardTitle>Routing</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Leer lassen = Wert aus der Host-Umgebung übernehmen. Der Platzhalter zeigt den aktuell
                effektiven Wert.
              </p>
              <TextField
                name="publicAppUrl"
                label="Öffentliche App-URL"
                defaultValue={d.publicAppUrl}
                placeholder={proxy.publicAppUrl ?? "aus Env / nicht gesetzt"}
              />
              <TextField
                name="studioUrl"
                label="Studio-URL"
                defaultValue={d.studioUrl}
                placeholder={proxy.studioUrl ?? "aus Env / nicht gesetzt"}
              />
              <TextField
                name="portalUrl"
                label="Portal-URL"
                defaultValue={d.portalUrl}
                placeholder={proxy.portalUrl ?? "aus Env / nicht gesetzt"}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="studioPath"
                  label="Studio-Pfad"
                  defaultValue={d.studioPath}
                  placeholder={proxy.studioPath}
                />
                <TextField
                  name="portalPath"
                  label="Portal-Pfad"
                  defaultValue={d.portalPath}
                  placeholder={proxy.portalPath}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cloudflare</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <OverrideField name="cloudflareTunnel" label="Cloudflare Tunnel" value={d.cloudflareTunnel} />
              <OverrideField name="trustProxy" label="Trust Proxy" value={d.trustProxy} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>„Ich bin ein Mensch“-Prüfung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <OverrideField
                name="turnstileEnabled"
                label="„Mensch“-Prüfung (Turnstile) aktiv"
                value={d.turnstileEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Aktiv nur, wenn Site-Key und Secret vorhanden sind (per Env oder hier).
              </p>
              <TextField
                name="turnstileSiteKey"
                label="Turnstile Site-Key (öffentlich)"
                defaultValue={d.turnstileSiteKey}
                placeholder="aus Env / nicht gesetzt"
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Turnstile Secret</span>
                <input
                  type="password"
                  name="turnstileSecret"
                  autoComplete="new-password"
                  className="rounded border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder={
                    d.turnstileSecretConfigured
                      ? "gesetzt — leer lassen, um zu behalten"
                      : "Secret eingeben"
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearTurnstileSecret" />
                Gespeichertes Secret löschen (Env-Fallback)
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sicherheit</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <OverrideField
                name="authRequired"
                label="Auth erforderlich"
                value={d.authRequired}
                hint="Das Login-Gate erzwingt die Edge-Middleware aus der Env — hier greift der Wert erst nach einem Neustart mit angepasster .env."
              />
              <OverrideField
                name="sessionCookieSecure"
                label="Session-Cookie Secure"
                value={d.sessionCookieSecure}
              />
              <OverrideField
                name="playerPreviewPublic"
                label="Player-Preview öffentlich"
                value={d.playerPreviewPublic}
              />
            </CardContent>
          </Card>

          <div>
            <Button type="submit">
              Einstellungen speichern
            </Button>
          </div>
        </form>
      </div>
    </SystemShell>
  );
}

function SourceBadge({ source }: { source: Source }) {
  return (
    <span
      className="ml-2 rounded px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border"
      title={source === "db" ? "In der Datenbank gesetzt" : "Aus der Host-Umgebung"}
    >
      {source === "db" ? "DB" : "Env"}
    </span>
  );
}

function StatusCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; source: Source }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[14rem_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">
                {row.label}
                <SourceBadge source={row.source} />
              </dt>
              <dd className="font-mono break-all">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="rounded border border-input bg-background px-3 py-2 font-mono text-sm"
      />
    </label>
  );
}

function OverrideField({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value: DeploymentSettings["trustProxy"];
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="env">Automatisch (Env)</option>
        <option value="on">An</option>
        <option value="off">Aus</option>
      </select>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
