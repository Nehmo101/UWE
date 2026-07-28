/**
 * Der Tunnel-Ingress, den UWE selbst besitzt.
 *
 * Ein Cloudflare Tunnel bildet öffentliche Hostnamen auf lokale Ports ab. Bisher
 * war das Handarbeit im Dashboard oder ein Bash-Skript auf dem Host — und wer
 * eine App vergaß (zuletzt Family), bekam Links, die ins Leere zeigten. Dieses
 * Modul leitet die Soll-Routen aus derselben Konfiguration ab, aus der auch die
 * Links entstehen (`@uwe/auth`), damit Link-Ziel und Ingress nicht auseinander
 * laufen können.
 *
 * Reines Planen: kein Netz, kein Dateisystem. Das Anwenden liegt in
 * `tunnel-client.ts`.
 */

import {
  resolveBrainPublicBaseUrl,
  resolveFamilyPublicBaseUrl,
  resolvePortalPublicBaseUrl,
  resolveStudioPublicBaseUrl,
} from "@uwe/auth";

/** Eine Ingress-Regel, wie die Cloudflare-API sie erwartet. */
export interface TunnelIngressRule {
  hostname?: string;
  path?: string;
  service: string;
}

/** Eine geplante Route mit Klartext-Label für die Oberfläche. */
export interface TunnelRoutePlan {
  label: string;
  hostname: string;
  path?: string;
  port: number;
}

export interface TunnelIngressPlan {
  /** Apex-Domain der Installation; leer, wenn keine öffentliche Domain konfiguriert ist. */
  apexHost: string;
  routes: TunnelRoutePlan[];
  /** Hostnamen, die einen DNS-Eintrag auf den Tunnel brauchen. */
  dnsHosts: string[];
  /** Verständliche Hinweise für die Oberfläche (nie Fehler, nie Secrets). */
  notes: string[];
  /** False, wenn ohne öffentliche Domain nichts geplant werden kann. */
  ok: boolean;
}

export interface TunnelIdentity {
  accountId: string;
  tunnelId: string;
}

const CATCH_ALL_SERVICE = "http_status:404";

function hostOf(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Nur echte öffentliche Hostnamen taugen als Tunnel-Ziel. */
function isPublicHost(host: string): boolean {
  return (
    host.length > 0 &&
    host.includes(".") &&
    host !== "localhost" &&
    host !== "::1" &&
    !host.startsWith("127.")
  );
}

function portFrom(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function isBrainTunnelOptIn(env: NodeJS.ProcessEnv): boolean {
  const raw = env.BRAIN_PUBLIC_TUNNEL?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Dekodiert das cloudflared-Tunnel-Token (Base64-JSON mit `a` = Account-ID und
 * `t` = Tunnel-ID). Gibt `null` zurück, statt zu werfen — ein unbrauchbares
 * Token ist ein Bedienfehler, kein Absturzgrund. Das Token selbst wird nirgends
 * ausgegeben.
 */
export function decodeTunnelToken(token: string | null | undefined): TunnelIdentity | null {
  const trimmed = token?.trim();
  if (!trimmed) return null;
  try {
    const padded = trimmed + "=".repeat((4 - (trimmed.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      a?: unknown;
      t?: unknown;
    };
    const accountId = typeof decoded.a === "string" ? decoded.a.trim() : "";
    const tunnelId = typeof decoded.t === "string" ? decoded.t.trim() : "";
    return accountId && tunnelId ? { accountId, tunnelId } : null;
  } catch {
    return null;
  }
}

/**
 * Leitet die Soll-Routen aus der Host-Konfiguration ab.
 *
 * Die Hostnamen kommen aus denselben Resolvern wie die Links in der App — Family
 * also inklusive der aus dem Split-Hostname-Layout abgeleiteten Adresse. Brain
 * bleibt draußen, solange `BRAIN_PUBLIC_TUNNEL` nicht ausdrücklich gesetzt ist
 * (ADR 004/007).
 */
export function buildTunnelIngressPlan(env: NodeJS.ProcessEnv = process.env): TunnelIngressPlan {
  const studioHost = hostOf(resolveStudioPublicBaseUrl(env));
  const portalHost = hostOf(resolvePortalPublicBaseUrl(env));
  const familyHost = hostOf(resolveFamilyPublicBaseUrl(env));
  const brainHost = hostOf(resolveBrainPublicBaseUrl(env));

  let apexHost = hostOf(env.PUBLIC_BASE_URL ?? env.PUBLIC_APP_URL);
  if (!isPublicHost(apexHost)) {
    // Der Apex steckt sonst noch in einer App-Adresse: studio.example.org → example.org
    const sibling = [studioHost, portalHost].find(isPublicHost);
    apexHost = sibling ? sibling.slice(sibling.indexOf(".") + 1) : "";
  }

  if (!isPublicHost(apexHost)) {
    return {
      apexHost: "",
      routes: [],
      dnsHosts: [],
      notes: [
        "Keine öffentliche Domain konfiguriert — setze die öffentliche Basis-URL (PUBLIC_BASE_URL) in den Deployment-Einstellungen.",
      ],
      ok: false,
    };
  }

  const notes: string[] = [];
  const routes: TunnelRoutePlan[] = [];

  const appRoute = (
    label: string,
    host: string,
    fallbackLabel: string,
    port: number,
  ): void => {
    const hostname = isPublicHost(host) ? host : `${fallbackLabel}.${apexHost}`;
    routes.push({ label, hostname, port });
  };

  appRoute("Studio", studioHost, "studio", portFrom(env.STUDIO_PORT, 3000));
  appRoute("Portal", portalHost, "portal", portFrom(env.PORTAL_PORT, 3001));
  appRoute("Family", familyHost, "family", portFrom(env.FAMILY_PORT, 3004));

  if (isBrainTunnelOptIn(env)) {
    appRoute("Brain", brainHost, "brain", portFrom(env.BRAIN_PORT, 3002));
    notes.push("Brain ist per BRAIN_PUBLIC_TUNNEL im Tunnel — owner-only auf jeder Route, 2FA vorausgesetzt.");
  } else {
    notes.push("Brain bleibt lokal (kein BRAIN_PUBLIC_TUNNEL) — das ist die sichere Vorgabe.");
  }

  const studioPort = portFrom(env.STUDIO_PORT, 3000);
  const portalPort = portFrom(env.PORTAL_PORT, 3001);
  routes.push({ label: "Apex /studio (Alt-Pfad)", hostname: apexHost, path: "/studio", port: studioPort });
  routes.push({ label: "Apex /portal (Alt-Pfad)", hostname: apexHost, path: "/portal", port: portalPort });
  routes.push({ label: "Startseite", hostname: apexHost, port: portFrom(env.LANDING_PORT, 3103) });

  const dnsHosts = [...new Set(routes.map((route) => route.hostname))];

  return { apexHost, routes, dnsHosts, notes, ok: true };
}

/** Übersetzt den Plan in die Ingress-Regeln der Cloudflare-API. */
export function planToIngressRules(plan: TunnelIngressPlan): TunnelIngressRule[] {
  return plan.routes.map((route) => ({
    hostname: route.hostname,
    ...(route.path ? { path: route.path } : {}),
    service: `http://127.0.0.1:${route.port}`,
  }));
}

/** Schlüssel einer Regel: Hostname plus Pfad — beides zusammen macht sie eindeutig. */
function ruleKey(rule: TunnelIngressRule): string {
  return `${(rule.hostname ?? "").toLowerCase()}|${rule.path ?? ""}`;
}

export interface MergedIngress {
  rules: TunnelIngressRule[];
  /** Fremde Regeln, die unverändert übernommen wurden. */
  preserved: TunnelIngressRule[];
}

/**
 * Führt Soll-Regeln mit dem aktuellen Ingress zusammen.
 *
 * Ein blindes Überschreiben würde fremde Routen löschen, die jemand von Hand
 * angelegt hat — dieselbe Rücksicht wie bei den WAF-Regeln
 * (`mergeManagedChallengeRule`). Fremde Regeln stehen vorn, weil sie in der
 * Regel spezifischer sind (etwa ein eigener Pfad auf dem Apex) und cloudflared
 * die erste passende Regel nimmt. Was UWE selbst besitzt — dieselbe Kombination
 * aus Hostname und Pfad — wird ersetzt, und der 404-Fallback steht immer am Ende.
 */
export function mergeTunnelIngress(
  current: TunnelIngressRule[],
  desired: TunnelIngressRule[],
): MergedIngress {
  const ownKeys = new Set(desired.map(ruleKey));
  const preserved = current.filter(
    (rule) => Boolean(rule.hostname) && !ownKeys.has(ruleKey(rule)),
  );

  return {
    rules: [...preserved, ...desired, { service: CATCH_ALL_SERVICE }],
    preserved,
  };
}

/** True, wenn der aktuelle Ingress bereits jede Soll-Regel identisch enthält. */
export function ingressMatchesPlan(
  current: TunnelIngressRule[],
  desired: TunnelIngressRule[],
): boolean {
  const currentKeys = new Map(current.map((rule) => [ruleKey(rule), rule.service]));
  return desired.every((rule) => currentKeys.get(ruleKey(rule)) === rule.service);
}
