import { requireOwner } from "@/src/lib/auth";
import { SettingsService, getProxyStatus, prisma } from "@uwe/database/server";
import { applyDeploymentRuntimeOverrides, type DeploymentSettings } from "@uwe/database/deployment";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { CloudflareStatusAutoRefresh } from "@/components/CloudflareStatusAutoRefresh";
import { CloudflareTunnelHealthPanel } from "@/components/CloudflareTunnelHealthPanel";
import { CloudflareManagedChallengePanel } from "@/components/CloudflareManagedChallengePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Alert } from "@/src/components/ui/states";
import { formatListInput } from "@uwe/cloudflare-edge";
import { managedChallengeConfigFromSettings } from "@/src/lib/cloudflare-challenge-sync";
import { reapplyManagedChallengeAction, updateDeploymentConfigAction } from "./actions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: Promise<{ saved?: string; challenge?: string }>;
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
    searchParams ?? Promise.resolve({} as { saved?: string; challenge?: string }),
  ]);
  const d = settings.deployment;
  // Keep the shared runtime-config overlay in sync with the persisted settings so the
  // effective status below reflects the database even if the boot-time load was skipped.
  applyDeploymentRuntimeOverrides(d);
  const proxy = getProxyStatus();
  const cf = proxy.cloudflare;

  const brainExposureLabel: Record<DeploymentSettings["brainExposure"], string> = {
    loopback: "Nur lokal (Loopback)",
    lan: "LAN (nach Owner-Freigabe)",
    public: "Öffentlich (owner-gated Tunnel)",
    off: "Deaktiviert",
  };

  // Brain is listed alongside Studio and Portal so all three products are visible
  // as peers. Brain stays owner-only (see the dedicated card below); by
  // default it shares the Studio origin and is reached via /life-brain.
  const routing: { label: string; value: string; source: Source }[] = [
    { label: "Deployment-Modell", value: proxy.deploymentModel, source: "env" },
    { label: "Öffentliche App-URL", value: proxy.publicAppUrl ?? "—", source: stringSource(d.publicAppUrl) },
    { label: "Studio-URL", value: proxy.studioUrl ?? "—", source: stringSource(d.studioUrl) },
    { label: "Portal-URL", value: proxy.portalUrl ?? "—", source: stringSource(d.portalUrl) },
    {
      label: "Brain-URL (lokal)",
      value: d.brainUrl.trim() || `${proxy.studioUrl ?? "Studio-Origin"} · teilt Studio`,
      source: stringSource(d.brainUrl),
    },
    { label: "Studio-Pfad", value: proxy.studioPath, source: stringSource(d.studioPath) },
    { label: "Portal-Pfad", value: proxy.portalPath, source: stringSource(d.portalPath) },
    { label: "Brain-Einstieg", value: d.brainPath.trim() || "/life-brain", source: stringSource(d.brainPath) },
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

  // Desired state of the edge Managed Challenge — the live Cloudflare state is
  // fetched separately by CloudflareManagedChallengePanel.
  const challenge = managedChallengeConfigFromSettings(d);
  const challengeRows: { label: string; value: string; source: Source }[] = [
    { label: "Managed Challenge gewünscht", value: yesNo(challenge.enabled), source: "db" },
    {
      label: "Geschützte Hostnames",
      value: challenge.hostnames.join(", ") || "—",
      source: d.managedChallengeHostnames.length > 0 ? "db" : "env",
    },
    { label: "Challenge-Stufe", value: challenge.action, source: "db" },
    {
      label: "Cloudflare Zone-ID",
      value: d.cloudflareZoneId.trim() || process.env.CLOUDFLARE_ZONE_ID?.trim() || "—",
      source: stringSource(d.cloudflareZoneId),
    },
    {
      label: "Cloudflare API-Token hinterlegt",
      value: yesNo(d.cloudflareApiTokenConfigured || Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim())),
      source: d.cloudflareApiTokenConfigured ? "db" : "env",
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

  const brain: { label: string; value: string; source: Source }[] = [
    {
      label: "Erreichbarkeit",
      value: brainExposureLabel[d.brainExposure],
      source: d.brainExposure === "loopback" ? "env" : "db",
    },
    { label: "Im öffentlichen Tunnel", value: "Nein — nie (ADR 004/007)", source: "env" },
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

        {params.challenge === "failed" && (
          <Alert tone="danger" icon="cloud" title="Managed Challenge nicht angewendet">
            Die WAF-Regel konnte nicht zu Cloudflare geschrieben werden — prüfe Zone-ID und
            API-Token (Rechte: <code>Zone → Zone WAF → Edit</code>). Details im Status-Panel unten.
          </Alert>
        )}

        {params.challenge === "pending" && challenge.enabled && (
          <Alert tone="warning" icon="cloud" title="Managed Challenge nur vorgemerkt">
            Ohne Cloudflare-Zone-ID und API-Token kann UWE die Regel nicht selbst setzen. Der
            Soll-Zustand liegt host-lesbar unter <code>data/cloudflare/managed-challenge.json</code>{" "}
            — anwenden mit{" "}
            <code>bash deploy/scripts/configure-cloudflare-managed-challenge.sh</code>.
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
          <StatusCard title="Managed Challenge (Edge)" rows={challengeRows} />
          <CloudflareManagedChallengePanel />
          <StatusCard title="Sicherheit" rows={security} />
          <StatusCard title="Brain (lokal, owner-only)" rows={brain} />
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
              <CardTitle>Managed Challenge (Cloudflare Edge)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Ganzseitige „Verify you are human“-Prüfung <strong>vor</strong> UWE — sie greift für
                jeden Request, nicht nur für den Login. UWE legt dafür genau eine WAF-Custom-Rule in
                deiner Zone an und pflegt sie beim Speichern selbst; eigene WAF-Regeln bleiben
                unberührt. Ohne Zone-ID und API-Token wird der Wunsch nur host-lesbar hinterlegt.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="managedChallengeEnabled"
                  defaultChecked={d.managedChallengeEnabled}
                />
                Managed Challenge an der Edge aktivieren
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Challenge-Stufe</span>
                <select
                  name="managedChallengeAction"
                  defaultValue={d.managedChallengeAction}
                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="managed_challenge">
                    Managed Challenge (empfohlen — Cloudflare wählt die leichteste Prüfung)
                  </option>
                  <option value="js_challenge">JS Challenge (immer Challenge-Seite)</option>
                </select>
              </label>
              <TextAreaField
                name="managedChallengeHostnames"
                label="Geschützte Hostnames (eine pro Zeile)"
                defaultValue={formatListInput(d.managedChallengeHostnames)}
                placeholder={challenge.hostnames.join("\n") || "leer = alle konfigurierten UWE-Origins"}
                hint="Leer lassen = automatisch aus den oben konfigurierten Landing-, Studio-, Portal- und Brain-URLs."
              />
              <TextAreaField
                name="managedChallengeSkipPaths"
                label="Zusätzliche Ausnahme-Pfade (eine pro Zeile)"
                defaultValue={formatListInput(d.managedChallengeSkipPaths)}
                placeholder="/api/webhooks"
                hint={`Immer ausgenommen (nicht abschaltbar): ${challenge.skipPaths.join(", ")} — Health-Probes und interne Callbacks würden an einer Challenge-Seite scheitern.`}
              />
              <TextField
                name="cloudflareZoneId"
                label="Cloudflare Zone-ID"
                defaultValue={d.cloudflareZoneId}
                placeholder="aus Env (CLOUDFLARE_ZONE_ID) / nicht gesetzt"
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Cloudflare API-Token</span>
                <input
                  type="password"
                  name="cloudflareApiToken"
                  autoComplete="new-password"
                  className="rounded border border-input bg-background px-3 py-2 font-mono text-sm"
                  placeholder={
                    d.cloudflareApiTokenConfigured
                      ? "gesetzt — leer lassen, um zu behalten"
                      : "Token mit Zone → Zone WAF → Edit"
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Wird verschlüsselt gespeichert und nie angezeigt. Benötigte Rechte:{" "}
                  <code>Zone → Zone WAF → Edit</code> auf der UWE-Zone.
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clearCloudflareApiToken" />
                Gespeicherten API-Token löschen (Env-Fallback)
              </label>
              <div>
                <Button type="submit" variant="ghost" formAction={reapplyManagedChallengeAction}>
                  Nur Regel erneut anwenden
                </Button>
              </div>
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

          <Card>
            <CardHeader>
              <CardTitle>Brain (lokal, owner-only)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Der private Brain-Bereich (Daily Admin OS &amp; Personal Brain) ist{" "}
                <strong>owner-only</strong> — jede Route prüft die Rolle serverseitig. Die
                Erreichbarkeit ist davon unabhängig: lokal, im LAN oder öffentlich unter eigenem
                Origin über den owner-gated Tunnel (dann <code>BRAIN_PUBLIC_TUNNEL=1</code>; 2FA auf
                dem Owner-Konto wird dringend empfohlen).
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Erreichbarkeit</span>
                <select
                  name="brainExposure"
                  defaultValue={d.brainExposure}
                  className="rounded border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="loopback">Nur lokal (Loopback)</option>
                  <option value="lan">LAN (nach Owner-Freigabe)</option>
                  <option value="public">Öffentlich (owner-gated Tunnel)</option>
                  <option value="off">Deaktiviert</option>
                </select>
              </label>
              <TextField
                name="brainUrl"
                label="Brain-URL (optional, eigenes Origin)"
                defaultValue={d.brainUrl}
                placeholder="leer = teilt das Studio-Origin"
              />
              <TextField
                name="brainPath"
                label="Brain-Einstiegspfad"
                defaultValue={d.brainPath}
                placeholder="/life-brain"
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

function TextAreaField({
  name,
  label,
  defaultValue,
  placeholder,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={3}
        className="rounded border border-input bg-background px-3 py-2 font-mono text-sm"
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
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
