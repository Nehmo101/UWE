import fs from "node:fs";
import path from "node:path";

import {
  applyTunnelIngress,
  buildTunnelIngressPlan,
  decodeTunnelToken,
  fetchTunnelIngressState,
} from "@uwe/cloudflare-edge";
import { SettingsService, type PrismaClient } from "@uwe/database/server";
import { resolveCloudflareEdgeCredentials } from "@uwe/database/deployment";

import { commandCenterDataRoot } from "../desktop-host.ts";

/**
 * Öffentliche Adressen einrichten — die Routen des Cloudflare Tunnels aus der
 * Kommandozentrale statt aus dem Dashboard oder einem Bash-Skript auf dem Host.
 *
 * Alles Nötige liegt bereits vor: das Tunnel-Token im Datenverzeichnis der
 * Kommandozentrale (daraus kommen Account- und Tunnel-ID) und das
 * Cloudflare-API-Token in den Deployment-Einstellungen, sonst aus der Umgebung.
 * Die Soll-Routen leitet `@uwe/cloudflare-edge` aus derselben Konfiguration ab,
 * aus der auch die Links in der App entstehen — Link-Ziel und Ingress können
 * also nicht auseinander laufen.
 *
 * Das API-Token wird nie zurückgegeben; die Antworten enthalten nur Zustände.
 */

/** Dasselbe Token-Ablageziel, das `cloudflare-tunnel-cli.ts` beschreibt. */
function tunnelTokenFile(): string {
  return path.join(commandCenterDataRoot(), "cloudflare-tunnel.token");
}

function readTunnelToken(): string | null {
  try {
    return fs.readFileSync(tunnelTokenFile(), "utf8").trim() || null;
  } catch {
    return null;
  }
}

async function resolveCredentials(db: PrismaClient) {
  const settings = await new SettingsService(db).getSettings();
  return resolveCloudflareEdgeCredentials(settings.deployment);
}

/**
 * Zeigt, welche Routen UWE setzen würde und wie der Tunnel gerade aussieht —
 * ohne etwas zu verändern.
 */
export async function getTunnelIngressStatus(db: PrismaClient): Promise<unknown> {
  const plan = buildTunnelIngressPlan(process.env);
  const identity = decodeTunnelToken(readTunnelToken());
  const { apiToken, zoneId } = await resolveCredentials(db);

  const base = {
    plan,
    tunnelConfigured: identity !== null,
    apiTokenConfigured: Boolean(apiToken),
    zoneIdConfigured: Boolean(zoneId),
  };

  if (!identity) {
    return {
      ...base,
      ok: false,
      inSync: false,
      message: "Kein Tunnel-Token hinterlegt — im Cloudflare-Bereich speichern.",
      current: null,
    };
  }
  if (!apiToken) {
    return {
      ...base,
      ok: false,
      inSync: false,
      message:
        "Kein Cloudflare-API-Token hinterlegt (Rechte: Account → Cloudflare Tunnel → Edit, Zone → DNS → Edit).",
      current: null,
    };
  }

  const current = await fetchTunnelIngressState(apiToken, identity, plan, {});
  return {
    ...base,
    ok: current.ok,
    inSync: current.inSync,
    message: current.message,
    current: current.rules,
  };
}

/** Schreibt die Routen in den Tunnel und stellt die DNS-Einträge sicher. */
export async function applyTunnelIngressNow(db: PrismaClient): Promise<unknown> {
  const plan = buildTunnelIngressPlan(process.env);
  const identity = decodeTunnelToken(readTunnelToken());
  if (!identity) {
    return { ok: false, changed: false, plan, message: "Kein Tunnel-Token hinterlegt.", dns: [] };
  }

  const { apiToken, zoneId } = await resolveCredentials(db);
  if (!apiToken) {
    return {
      ok: false,
      changed: false,
      plan,
      message:
        "Kein Cloudflare-API-Token hinterlegt (Rechte: Account → Cloudflare Tunnel → Edit, Zone → DNS → Edit).",
      dns: [],
    };
  }

  const result = await applyTunnelIngress(apiToken, identity, plan, zoneId, {});
  return { ...result, plan };
}
