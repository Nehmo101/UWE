/**
 * Cloudflare Rulesets API client — just enough to own one WAF custom rule.
 *
 * UWE reads the zone's `http_request_firewall_custom` entry-point ruleset,
 * replaces its own rule (see {@link isManagedChallengeRule}) and writes the list
 * back. Foreign rules are passed through untouched, so an operator's own WAF
 * rules survive every apply.
 *
 * Nothing here throws: every call returns a structured result, and no message
 * ever contains the API token.
 */

import {
  MANAGED_CHALLENGE_PHASE,
  buildManagedChallengeExpression,
  hasActiveManagedChallenge,
  isManagedChallengeRule,
  mergeManagedChallengeRule,
  type CloudflareRule,
  type ManagedChallengeConfig,
} from "./managed-challenge";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface CloudflareEdgeCredentials {
  /** API token with `Zone → Zone WAF → Edit` on the UWE zone. Never logged. */
  apiToken: string | null;
  /** Cloudflare Zone ID of the UWE domain. */
  zoneId: string | null;
}

export interface CloudflareApiOptions {
  /** Injectable fetch for testing. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Live state of the UWE-managed rule at the edge. */
export interface ManagedChallengeState {
  /** Whether the ruleset could be read at all. */
  ok: boolean;
  /** True when UWE's rule exists in the zone. */
  present: boolean;
  /** True when the rule exists *and* is enabled. */
  active: boolean;
  action: string | null;
  expression: string | null;
  rulesetId: string | null;
  /** Rules in the same ruleset that UWE does not manage. */
  foreignRuleCount: number;
  message: string;
}

export interface ApplyManagedChallengeResult {
  ok: boolean;
  /** True when the ruleset was actually written (no write on a no-op). */
  changed: boolean;
  message: string;
  state: ManagedChallengeState | null;
}

interface CloudflareApiEnvelope<T> {
  success?: boolean;
  result?: T;
  errors?: { code?: number; message?: string }[];
}

interface RulesetPayload {
  id?: string;
  rules?: CloudflareRule[];
}

const UNCONFIGURED_MESSAGE =
  "Cloudflare-Zugangsdaten fehlen — Zone-ID und API-Token in System → Cloudflare hinterlegen (oder CLOUDFLARE_ZONE_ID / CLOUDFLARE_API_TOKEN auf dem Host setzen).";

function describeErrors(payload: CloudflareApiEnvelope<unknown>, fallback: string): string {
  const messages = (payload.errors ?? [])
    .map((error) => error?.message)
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join("; ") : fallback;
}

function unreadableState(message: string): ManagedChallengeState {
  return {
    ok: false,
    present: false,
    active: false,
    action: null,
    expression: null,
    rulesetId: null,
    foreignRuleCount: 0,
    message,
  };
}

/** True when both a zone ID and an API token are available. */
export function hasCloudflareCredentials(
  credentials: CloudflareEdgeCredentials,
): credentials is { apiToken: string; zoneId: string } {
  return Boolean(credentials.apiToken?.trim() && credentials.zoneId?.trim());
}

/**
 * Strips server-managed fields (`version`, `last_updated`, …) from a rule read
 * back from the API so it can be sent again unchanged.
 */
function sanitizeRuleForWrite(rule: CloudflareRule): CloudflareRule {
  const out: CloudflareRule = {};
  if (rule.id) out.id = rule.id;
  if (rule.ref) out.ref = rule.ref;
  if (rule.action) out.action = rule.action;
  if (rule.action_parameters) out.action_parameters = rule.action_parameters;
  if (rule.expression) out.expression = rule.expression;
  if (rule.description !== undefined) out.description = rule.description;
  if (rule.enabled !== undefined) out.enabled = rule.enabled;
  if (rule.logging) out.logging = rule.logging;
  return out;
}

async function callCloudflare<T>(
  method: "GET" | "PUT",
  url: string,
  apiToken: string,
  body: unknown,
  options: CloudflareApiOptions,
): Promise<{ ok: boolean; status: number; payload: CloudflareApiEnvelope<T> }> {
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

    let payload: CloudflareApiEnvelope<T> = {};
    try {
      payload = (await response.json()) as CloudflareApiEnvelope<T>;
    } catch {
      payload = {};
    }
    return { ok: response.ok && payload.success !== false, status: response.status, payload };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      payload: {
        errors: [{ message: aborted ? "Zeitüberschreitung" : "Netzwerkfehler" }],
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function entrypointUrl(zoneId: string): string {
  return `${API_BASE}/zones/${encodeURIComponent(zoneId)}/rulesets/phases/${MANAGED_CHALLENGE_PHASE}/entrypoint`;
}

/**
 * Reads the current entry-point ruleset. A 404 is *not* an error — a zone
 * without custom rules simply has no entry-point ruleset yet.
 */
async function fetchEntrypoint(
  credentials: { apiToken: string; zoneId: string },
  options: CloudflareApiOptions,
): Promise<{ ok: boolean; ruleset: RulesetPayload | null; message: string }> {
  const response = await callCloudflare<RulesetPayload>(
    "GET",
    entrypointUrl(credentials.zoneId),
    credentials.apiToken,
    undefined,
    options,
  );

  if (response.status === 404) {
    return { ok: true, ruleset: null, message: "Noch keine WAF-Custom-Rules in dieser Zone." };
  }
  if (!response.ok) {
    return {
      ok: false,
      ruleset: null,
      message: describeErrors(response.payload, `Cloudflare-API-Fehler (HTTP ${response.status}).`),
    };
  }

  return { ok: true, ruleset: response.payload.result ?? null, message: "Ruleset gelesen." };
}

function stateFromRuleset(ruleset: RulesetPayload | null): ManagedChallengeState {
  const rules = ruleset?.rules ?? [];
  const managed = rules.find(isManagedChallengeRule) ?? null;
  const foreignRuleCount = rules.filter((rule) => !isManagedChallengeRule(rule)).length;

  return {
    ok: true,
    present: managed !== null,
    active: managed !== null && managed.enabled !== false,
    action: managed?.action ?? null,
    expression: managed?.expression ?? null,
    rulesetId: ruleset?.id ?? null,
    foreignRuleCount,
    message: managed
      ? `Managed Challenge aktiv an der Edge (${foreignRuleCount} fremde Regel(n) unberührt).`
      : "Keine von UWE verwaltete Managed-Challenge-Regel in dieser Zone.",
  };
}

/** Reads the live state of the UWE-managed rule without changing anything. */
export async function fetchManagedChallengeState(
  credentials: CloudflareEdgeCredentials,
  options: CloudflareApiOptions = {},
): Promise<ManagedChallengeState> {
  if (!hasCloudflareCredentials(credentials)) {
    return unreadableState(UNCONFIGURED_MESSAGE);
  }

  const entrypoint = await fetchEntrypoint(credentials, options);
  if (!entrypoint.ok) {
    return unreadableState(entrypoint.message);
  }
  return stateFromRuleset(entrypoint.ruleset);
}

/**
 * Brings the zone in line with the desired config: writes, updates or removes
 * UWE's rule. Skips the write when the edge already matches, so a repeated
 * apply (Studio save, host script, healthcheck) is cheap and idempotent.
 */
export async function applyManagedChallenge(
  config: ManagedChallengeConfig,
  credentials: CloudflareEdgeCredentials,
  options: CloudflareApiOptions = {},
): Promise<ApplyManagedChallengeResult> {
  if (!hasCloudflareCredentials(credentials)) {
    return { ok: false, changed: false, message: UNCONFIGURED_MESSAGE, state: null };
  }

  const entrypoint = await fetchEntrypoint(credentials, options);
  if (!entrypoint.ok) {
    return { ok: false, changed: false, message: entrypoint.message, state: null };
  }

  const existingRules = entrypoint.ruleset?.rules ?? [];
  const current = stateFromRuleset(entrypoint.ruleset);
  const shouldBeActive = hasActiveManagedChallenge(config);

  const alreadyCorrect = shouldBeActive
    ? current.active &&
      current.action === config.action &&
      current.expression === buildManagedChallengeExpression(config)
    : !current.present;

  if (alreadyCorrect) {
    return {
      ok: true,
      changed: false,
      message: shouldBeActive
        ? "Managed Challenge war bereits korrekt gesetzt."
        : "Managed Challenge war bereits deaktiviert.",
      state: current,
    };
  }

  const rules = mergeManagedChallengeRule(existingRules, config).map(sanitizeRuleForWrite);
  const response = await callCloudflare<RulesetPayload>(
    "PUT",
    entrypointUrl(credentials.zoneId),
    credentials.apiToken,
    { rules },
    options,
  );

  if (!response.ok) {
    return {
      ok: false,
      changed: false,
      message: describeErrors(
        response.payload,
        `Cloudflare-API-Fehler beim Schreiben (HTTP ${response.status}).`,
      ),
      state: current,
    };
  }

  const nextState = stateFromRuleset(response.payload.result ?? { rules });
  return {
    ok: true,
    changed: true,
    message: shouldBeActive
      ? "Managed Challenge an der Edge aktiviert."
      : "Managed Challenge an der Edge entfernt.",
    state: nextState,
  };
}
