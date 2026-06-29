import { requireOwner } from "@/src/lib/auth";
import { getProxyStatus } from "@uwe/database/server";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert } from "@/src/components/ui/states";

export const dynamic = "force-dynamic";

function yesNo(value: boolean): string {
  return value ? "Ja" : "Nein";
}

export default async function SystemCloudflarePage() {
  await requireOwner();
  const proxy = getProxyStatus();
  const cf = proxy.cloudflare;

  const routing: { label: string; value: string }[] = [
    { label: "Deployment-Modell", value: proxy.deploymentModel },
    { label: "Öffentliche App-URL", value: proxy.publicAppUrl ?? "—" },
    { label: "Studio-URL", value: proxy.studioUrl ?? "—" },
    { label: "Portal-URL", value: proxy.portalUrl ?? "—" },
    { label: "Studio-Pfad", value: proxy.studioPath },
    { label: "Portal-Pfad", value: proxy.portalPath },
    { label: "Studio auf eigenem Host", value: yesNo(cf.studioOnSeparateHost) },
  ];

  const cloudflare: { label: string; value: string }[] = [
    { label: "Tunnel konfiguriert", value: yesNo(cf.tunnelConfigured) },
    { label: "Access aktiviert", value: yesNo(cf.accessEnabled) },
    { label: "Access-Allowlist konfiguriert", value: yesNo(cf.allowlistConfigured) },
    { label: "Trust Proxy", value: yesNo(proxy.trustProxy) },
    { label: "Public Exposure konfiguriert", value: yesNo(proxy.publicExposureConfigured) },
  ];

  const security: { label: string; value: string }[] = [
    { label: "Auth erforderlich", value: yesNo(proxy.authRequired) },
    { label: "Session-Cookie Secure", value: yesNo(proxy.sessionCookieSecure) },
    { label: "Player-Preview öffentlich", value: yesNo(proxy.playerPreviewPublic) },
  ];

  const healthy = cf.tunnelConfigured && proxy.trustProxy && proxy.authRequired;

  return (
    <SystemShell breadcrumb={<span>System / Cloudflare</span>}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Cloudflare</h1>
          <p className="text-sm text-muted-foreground">
            Read-only Status von Routing, Cloudflare-Tunnel/Access und Sicherheits-Flags. Es werden
            keine Secrets angezeigt. Details siehe <code>docs/cloudflare-current-setup.md</code>.
          </p>
        </header>

        {healthy ? (
          <Alert tone="success" icon="shield-check" title="Cloudflare/Proxy konfiguriert">
            Tunnel, Trust-Proxy und Auth sind aktiv.
          </Alert>
        ) : (
          <Alert tone="warning" icon="cloud" title="Konfiguration unvollständig">
            Tunnel, Trust-Proxy oder Auth sind nicht vollständig aktiviert — prüfe die Env-Variablen
            (siehe Doku).
          </Alert>
        )}

        <StatusCard title="Routing" rows={routing} />
        <StatusCard title="Cloudflare" rows={cloudflare} />
        <StatusCard title="Sicherheit" rows={security} />
      </div>
    </SystemShell>
  );
}

function StatusCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[14rem_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-mono break-all">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
