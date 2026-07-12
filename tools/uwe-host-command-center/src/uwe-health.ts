import {
  collectServiceStatus,
  type HostSeverity,
  type SystemdUnitStatus,
} from "@uwe/host-monitor";

export interface UweEndpointProbe {
  label: string;
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  severity: HostSeverity;
  message: string;
}

export interface UweQuickLink {
  label: string;
  href: string;
  external: boolean;
}

export interface UweReachability {
  studioPort: number;
  portalPort: number;
  studio: UweEndpointProbe;
  portal: UweEndpointProbe;
  studioHealth: UweEndpointProbe;
  cloudflared: SystemdUnitStatus | null;
  links: UweQuickLink[];
}

const DEFAULT_TIMEOUT_MS = 4000;

function severityFromHttp(ok: boolean, statusCode: number | null): HostSeverity {
  if (ok) return "ok";
  if (statusCode != null && statusCode >= 500) return "error";
  if (statusCode != null) return "warn";
  return "error";
}

async function probeUrl(label: string, url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<UweEndpointProbe> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "manual",
      headers: { accept: "text/html,application/json" },
    });
    const latencyMs = Date.now() - started;
    const ok = response.status > 0 && response.status < 500;
    return {
      label,
      url,
      ok,
      statusCode: response.status,
      latencyMs,
      severity: severityFromHttp(ok, response.status),
      message: ok ? `HTTP ${response.status} · ${latencyMs} ms` : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "Nicht erreichbar";
    return {
      label,
      url,
      ok: false,
      statusCode: null,
      latencyMs,
      severity: "error",
      message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolvePorts(): { studioPort: number; portalPort: number } {
  const studioPort = Number(process.env.STUDIO_PORT ?? process.env.PORT ?? 3000);
  const portalPort = Number(process.env.PORTAL_PORT ?? 3001);
  return {
    studioPort: Number.isFinite(studioPort) ? studioPort : 3000,
    portalPort: Number.isFinite(portalPort) ? portalPort : 3001,
  };
}

function buildLinks(studioPort: number, portalPort: number, studioUp: boolean): UweQuickLink[] {
  const studioBase = `http://127.0.0.1:${studioPort}`;
  const portalBase = `http://127.0.0.1:${portalPort}`;
  const links: UweQuickLink[] = [
    { label: "Studio", href: studioBase, external: true },
    { label: "Portal", href: portalBase, external: true },
  ];
  if (studioUp) {
    links.push(
      { label: "Kommandozentrale", href: `${studioBase}/system/command-center`, external: true },
      { label: "Einrichtung", href: `${studioBase}/admin/setup`, external: true },
      { label: "Host Control", href: `${studioBase}/system/host-control`, external: true },
      { label: "Backup", href: `${studioBase}/backup`, external: true },
      { label: "Cloudflare", href: `${studioBase}/system/cloudflare`, external: true },
    );
  }
  return links;
}

export async function collectUweReachability(): Promise<UweReachability> {
  const { studioPort, portalPort } = resolvePorts();
  const studioUrl = `http://127.0.0.1:${studioPort}/`;
  const portalUrl = `http://127.0.0.1:${portalPort}/`;
  const healthUrl = `http://127.0.0.1:${studioPort}/api/health`;

  const [studio, portal, studioHealth, cloudflaredStatuses] = await Promise.all([
    probeUrl("Studio", studioUrl),
    probeUrl("Portal", portalUrl),
    probeUrl("Studio Health", healthUrl),
    collectServiceStatus({
      units: [{ unit: "cloudflared.service", label: "Cloudflare Tunnel", kind: "service" }],
    }),
  ]);

  return {
    studioPort,
    portalPort,
    studio,
    portal,
    studioHealth,
    cloudflared: cloudflaredStatuses[0] ?? null,
    links: buildLinks(studioPort, portalPort, studio.ok),
  };
}
