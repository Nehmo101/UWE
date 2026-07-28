/**
 * Cloudflare-Tunnel-API — gerade so viel, wie UWE für seine eigenen Routen
 * braucht: den Ingress des Tunnels lesen und schreiben und die DNS-Einträge
 * sicherstellen, die jeder Hostname auf den Tunnel braucht.
 *
 * Wie im Ruleset-Client: nichts wirft, jede Antwort ist ein strukturiertes
 * Ergebnis, und keine Meldung enthält je das API-Token.
 */

import {
  ingressMatchesPlan,
  mergeTunnelIngress,
  planToIngressRules,
  type TunnelIdentity,
  type TunnelIngressPlan,
  type TunnelIngressRule,
} from "./tunnel-ingress";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface TunnelApiOptions {
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface TunnelIngressState {
  ok: boolean;
  rules: TunnelIngressRule[];
  /** True, wenn der Ingress bereits alle Soll-Routen enthält. */
  inSync: boolean;
  message: string;
}

export type DnsOutcome = "unchanged" | "created" | "updated" | "failed";

export interface DnsRecordResult {
  hostname: string;
  outcome: DnsOutcome;
  message: string;
}

export interface ApplyTunnelIngressResult {
  ok: boolean;
  /** True, wenn der Ingress tatsächlich geschrieben wurde (kein Schreiben bei No-Op). */
  changed: boolean;
  message: string;
  /** Fremde Routen, die unverändert erhalten blieben. */
  preservedHostnames: string[];
  dns: DnsRecordResult[];
}

interface ApiEnvelope<T> {
  success?: boolean;
  result?: T;
  errors?: { code?: number; message?: string }[];
}

interface TunnelConfigPayload {
  config?: { ingress?: TunnelIngressRule[] };
}

interface DnsRecordPayload {
  id?: string;
  content?: string;
  proxied?: boolean;
}

interface ZonePayload {
  id?: string;
}

function describeErrors<T>(payload: ApiEnvelope<T>, fallback: string): string {
  const messages = (payload.errors ?? [])
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join("; ") : fallback;
}

async function callCloudflare<T>(
  method: "GET" | "POST" | "PUT" | "PATCH",
  url: string,
  apiToken: string,
  body: unknown,
  options: TunnelApiOptions,
): Promise<{ ok: boolean; status: number; payload: ApiEnvelope<T> }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { ok: false, status: 0, payload: { errors: [{ message: "fetch nicht verfügbar" }] } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    let payload: ApiEnvelope<T> = {};
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      payload = {};
    }
    return { ok: response.ok && payload.success !== false, status: response.status, payload };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      payload: { errors: [{ message: aborted ? "Zeitüberschreitung" : "Netzwerkfehler" }] },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function configUrl(identity: TunnelIdentity): string {
  return `${API_BASE}/accounts/${encodeURIComponent(identity.accountId)}/cfd_tunnel/${encodeURIComponent(identity.tunnelId)}/configurations`;
}

/** Liest den aktuellen Ingress und vergleicht ihn mit dem Plan. */
export async function fetchTunnelIngressState(
  apiToken: string,
  identity: TunnelIdentity,
  plan: TunnelIngressPlan,
  options: TunnelApiOptions = {},
): Promise<TunnelIngressState> {
  const response = await callCloudflare<TunnelConfigPayload>(
    "GET",
    configUrl(identity),
    apiToken,
    undefined,
    options,
  );

  if (!response.ok) {
    return {
      ok: false,
      rules: [],
      inSync: false,
      message: describeErrors(
        response.payload,
        response.status === 403
          ? "Kein Zugriff auf den Tunnel — dem API-Token fehlt „Account → Cloudflare Tunnel → Edit“."
          : `Cloudflare-API-Fehler (HTTP ${response.status}).`,
      ),
    };
  }

  const rules = response.payload.result?.config?.ingress ?? [];
  const desired = planToIngressRules(plan);
  return {
    ok: true,
    rules,
    inSync: plan.ok && ingressMatchesPlan(rules, desired),
    message: `${rules.length} Route(n) im Tunnel konfiguriert.`,
  };
}

/** Ermittelt die Zone-ID zur Apex-Domain, wenn keine hinterlegt ist. */
async function resolveZoneId(
  apiToken: string,
  apexHost: string,
  configuredZoneId: string | null,
  options: TunnelApiOptions,
): Promise<{ zoneId: string | null; message: string }> {
  const configured = configuredZoneId?.trim();
  if (configured) return { zoneId: configured, message: "Zone-ID aus der Konfiguration." };

  const response = await callCloudflare<ZonePayload[]>(
    "GET",
    `${API_BASE}/zones?name=${encodeURIComponent(apexHost)}`,
    apiToken,
    undefined,
    options,
  );
  if (!response.ok) {
    return {
      zoneId: null,
      message: describeErrors(response.payload, "Zone nicht lesbar — dem Token fehlt „Zone → DNS → Edit“."),
    };
  }
  const zoneId = response.payload.result?.[0]?.id ?? null;
  return {
    zoneId,
    message: zoneId ? "Zone über die API gefunden." : `Keine Zone zu ${apexHost} gefunden.`,
  };
}

/**
 * Stellt einen proxied CNAME auf den Tunnel sicher. Ein passender Eintrag wird
 * nicht angefasst — Wiederholen ist damit folgenlos.
 */
async function ensureDnsRecord(
  apiToken: string,
  zoneId: string,
  hostname: string,
  target: string,
  options: TunnelApiOptions,
): Promise<DnsRecordResult> {
  const lookup = await callCloudflare<DnsRecordPayload[]>(
    "GET",
    `${API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records?name=${encodeURIComponent(hostname)}`,
    apiToken,
    undefined,
    options,
  );
  if (!lookup.ok) {
    return {
      hostname,
      outcome: "failed",
      message: describeErrors(lookup.payload, "DNS-Eintrag nicht lesbar."),
    };
  }

  const existing = lookup.payload.result?.[0] ?? null;
  if (existing?.content === target && existing.proxied === true) {
    return { hostname, outcome: "unchanged", message: "DNS zeigt bereits auf den Tunnel." };
  }

  const body = { type: "CNAME", name: hostname, content: target, proxied: true };
  const write = existing?.id
    ? await callCloudflare<DnsRecordPayload>(
        "PUT",
        `${API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existing.id)}`,
        apiToken,
        body,
        options,
      )
    : await callCloudflare<DnsRecordPayload>(
        "POST",
        `${API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records`,
        apiToken,
        body,
        options,
      );

  if (!write.ok) {
    return {
      hostname,
      outcome: "failed",
      message: describeErrors(write.payload, "DNS-Eintrag konnte nicht geschrieben werden."),
    };
  }

  return existing?.id
    ? { hostname, outcome: "updated", message: "DNS-Eintrag aktualisiert." }
    : { hostname, outcome: "created", message: "DNS-Eintrag angelegt." };
}

/**
 * Schreibt die UWE-Routen in den Tunnel und stellt die DNS-Einträge sicher.
 *
 * Fremde Routen bleiben erhalten (siehe {@link mergeTunnelIngress}); ein
 * bereits passender Ingress wird nicht neu geschrieben. Fehlende DNS-Rechte
 * lassen den Ingress trotzdem stehen — das Ergebnis benennt beides getrennt.
 */
export async function applyTunnelIngress(
  apiToken: string,
  identity: TunnelIdentity,
  plan: TunnelIngressPlan,
  configuredZoneId: string | null = null,
  options: TunnelApiOptions = {},
): Promise<ApplyTunnelIngressResult> {
  if (!plan.ok) {
    return {
      ok: false,
      changed: false,
      message: plan.notes[0] ?? "Keine öffentliche Domain konfiguriert.",
      preservedHostnames: [],
      dns: [],
    };
  }

  const state = await fetchTunnelIngressState(apiToken, identity, plan, options);
  if (!state.ok) {
    return { ok: false, changed: false, message: state.message, preservedHostnames: [], dns: [] };
  }

  const desired = planToIngressRules(plan);
  const merged = mergeTunnelIngress(state.rules, desired);
  const preservedHostnames = [
    ...new Set(merged.preserved.map((rule) => rule.hostname ?? "").filter(Boolean)),
  ];

  let changed = false;
  if (!state.inSync) {
    const write = await callCloudflare<TunnelConfigPayload>(
      "PUT",
      configUrl(identity),
      apiToken,
      { config: { ingress: merged.rules } },
      options,
    );
    if (!write.ok) {
      return {
        ok: false,
        changed: false,
        message: describeErrors(write.payload, "Ingress konnte nicht geschrieben werden."),
        preservedHostnames,
        dns: [],
      };
    }
    changed = true;
  }

  const zone = await resolveZoneId(apiToken, plan.apexHost, configuredZoneId, options);
  if (!zone.zoneId) {
    return {
      ok: false,
      changed,
      message: `Routen stehen im Tunnel, DNS aber nicht geprüft: ${zone.message}`,
      preservedHostnames,
      dns: [],
    };
  }

  const target = `${identity.tunnelId}.cfargotunnel.com`;
  const dns: DnsRecordResult[] = [];
  for (const hostname of plan.dnsHosts) {
    dns.push(await ensureDnsRecord(apiToken, zone.zoneId, hostname, target, options));
  }

  const failed = dns.filter((record) => record.outcome === "failed");
  const touched = dns.filter((record) => record.outcome !== "unchanged").length;

  return {
    ok: failed.length === 0,
    changed: changed || touched > 0,
    message:
      failed.length > 0
        ? `${failed.length} DNS-Eintrag/-Einträge fehlgeschlagen: ${failed.map((record) => record.hostname).join(", ")}`
        : changed || touched > 0
          ? `Routen aktiv: ${plan.routes.map((route) => route.hostname).join(", ")}.`
          : "Tunnel und DNS waren bereits korrekt eingerichtet.",
    preservedHostnames,
    dns,
  };
}
