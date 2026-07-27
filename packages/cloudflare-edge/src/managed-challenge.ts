/**
 * Cloudflare **Managed Challenge** — the full-page "Verify you are human"
 * interstitial Cloudflare shows in front of *everything* on a hostname.
 *
 * This is the edge-level counterpart to the in-app Turnstile widget
 * (`@uwe/auth/turnstile`, which only guards the login forms). Both can run at
 * the same time: the Managed Challenge filters bots before a request ever
 * reaches the UWE host, Turnstile guards the credential form itself.
 *
 * Technically the challenge is a single WAF **custom rule** in the zone's
 * `http_request_firewall_custom` phase entry point ruleset. UWE owns exactly one
 * rule in that ruleset — identified by {@link MANAGED_CHALLENGE_RULE_REF} — and
 * never touches the operator's other rules.
 *
 * This module is pure: it builds and validates the desired state. Talking to
 * Cloudflare lives in `./ruleset-client`, persisting the host-readable config in
 * `./config-file`.
 */

/** Stable `ref` marking the one rule in the zone that UWE manages. */
export const MANAGED_CHALLENGE_RULE_REF = "uwe_managed_challenge";

/** Human-readable description written onto the managed rule. */
export const MANAGED_CHALLENGE_RULE_DESCRIPTION =
  "UWE Managed Challenge - verwaltet von UWE (System > Cloudflare), nicht manuell bearbeiten";

/** Ruleset phase that holds zone-level WAF custom rules. */
export const MANAGED_CHALLENGE_PHASE = "http_request_firewall_custom";

/**
 * Challenge strength.
 *   - `managed_challenge` — Cloudflare picks the lightest sufficient check
 *     (usually non-interactive). The recommended default.
 *   - `js_challenge`      — always runs the JavaScript challenge page.
 */
export type ManagedChallengeAction = "managed_challenge" | "js_challenge";

export interface ManagedChallengeConfig {
  /** Desired state: whether the rule should exist and be active at the edge. */
  enabled: boolean;
  /** Hostnames the challenge applies to. Empty = nothing to protect (no rule). */
  hostnames: string[];
  /** Path prefixes exempt from the challenge (health probes, machine callbacks). */
  skipPaths: string[];
  action: ManagedChallengeAction;
}

/**
 * Paths that must stay reachable without a browser challenge: the tunnel and
 * uptime probes (`deploy/scripts/check-cloudflare-tunnel.sh`, the edge health
 * worker) and the agent-job callbacks are machine clients — a challenge page
 * would read as a hard outage to them.
 */
export const DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS: readonly string[] = [
  "/api/health",
  "/api/internal",
  "/api/agent-jobs",
];

export const DEFAULT_MANAGED_CHALLENGE_CONFIG: ManagedChallengeConfig = {
  enabled: false,
  hostnames: [],
  skipPaths: [...DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS],
  action: "managed_challenge",
};

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const PATH_PATTERN = /^\/[A-Za-z0-9\-._~/]*$/;

/**
 * Normalises a hostname candidate (bare host, or a full URL as stored in the
 * deployment settings) to a lowercase host, or null when it is not usable.
 * Rejecting rather than escaping keeps hostile input out of the Cloudflare
 * expression entirely.
 */
export function normalizeChallengeHostname(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  let value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  }
  // Drop a trailing port / path remainder and the root dot.
  value = value.split("/")[0]?.split(":")[0]?.replace(/\.$/, "") ?? "";
  return HOSTNAME_PATTERN.test(value) ? value : null;
}

/** Normalises a skip path to a leading-slash prefix, or null when unusable. */
export function normalizeChallengeSkipPath(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  let value = raw.trim();
  if (!value) {
    return null;
  }
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }
  if (value.length > 1) {
    value = value.replace(/\/+$/, "");
  }
  return PATH_PATTERN.test(value) ? value : null;
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))].sort();
}

function normalizeAction(raw: unknown): ManagedChallengeAction {
  return raw === "js_challenge" ? "js_challenge" : "managed_challenge";
}

/** Coerces an untrusted value (stored JSON, form input) into a valid config. */
export function normalizeManagedChallengeConfig(raw: unknown): ManagedChallengeConfig {
  const stored = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const hostnames = Array.isArray(stored.hostnames) ? stored.hostnames : [];
  const skipPaths = Array.isArray(stored.skipPaths)
    ? stored.skipPaths
    : [...DEFAULT_MANAGED_CHALLENGE_SKIP_PATHS];

  return {
    enabled: stored.enabled === true,
    hostnames: uniqueSorted(hostnames.map(normalizeChallengeHostname)),
    skipPaths: uniqueSorted(skipPaths.map(normalizeChallengeSkipPath)),
    action: normalizeAction(stored.action),
  };
}

/**
 * Parses a free-text list (textarea: one entry per line, commas allowed) into
 * raw entries, keeping order and dropping blanks. Normalisation happens in
 * {@link normalizeManagedChallengeConfig}.
 */
export function parseListInput(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Renders a list back into the textarea representation (one entry per line). */
export function formatListInput(values: readonly string[]): string {
  return values.join("\n");
}

/**
 * Reports entries that were dropped during normalisation, so the UI can tell the
 * owner *why* a hostname they typed is not protected instead of silently
 * ignoring it.
 */
export function collectManagedChallengeIssues(
  rawHostnames: readonly string[],
  rawSkipPaths: readonly string[] = [],
): string[] {
  const issues: string[] = [];
  for (const entry of rawHostnames) {
    if (normalizeChallengeHostname(entry) === null) {
      issues.push(`Hostname ignoriert (ungültig): ${entry}`);
    }
  }
  for (const entry of rawSkipPaths) {
    if (normalizeChallengeSkipPath(entry) === null) {
      issues.push(`Ausnahme-Pfad ignoriert (ungültig): ${entry}`);
    }
  }
  return issues;
}

/**
 * True when the config describes a rule that can actually be written: enabled
 * and with at least one hostname. An enabled config without hostnames is not an
 * error — it simply removes the rule, same as disabling it.
 */
export function hasActiveManagedChallenge(config: ManagedChallengeConfig): boolean {
  return config.enabled && config.hostnames.length > 0;
}

/**
 * Builds the Cloudflare Ruleset expression for the challenge.
 *
 * Every value is drawn from the already-normalised config, so the quoted string
 * literals can never contain a `"` and break out of the expression.
 */
export function buildManagedChallengeExpression(config: ManagedChallengeConfig): string {
  const hosts = config.hostnames.map((host) => `"${host}"`).join(" ");
  const hostMatch = `(http.host in {${hosts}})`;

  if (config.skipPaths.length === 0) {
    return hostMatch;
  }

  const skips = config.skipPaths
    .map((path) => `starts_with(http.request.uri.path, "${path}")`)
    .join(" or ");

  return `${hostMatch} and not (${skips})`;
}

/** A WAF custom rule as sent to / received from the Cloudflare Rulesets API. */
export interface CloudflareRule {
  id?: string;
  ref?: string;
  action?: string;
  action_parameters?: Record<string, unknown>;
  expression?: string;
  description?: string;
  enabled?: boolean;
  logging?: Record<string, unknown>;
}

/** True when a rule is the one UWE manages (by `ref`, with a description fallback). */
export function isManagedChallengeRule(rule: CloudflareRule): boolean {
  return (
    rule.ref === MANAGED_CHALLENGE_RULE_REF ||
    rule.description === MANAGED_CHALLENGE_RULE_DESCRIPTION
  );
}

/** Builds the desired rule payload for an active challenge. */
export function buildManagedChallengeRule(config: ManagedChallengeConfig): CloudflareRule {
  return {
    ref: MANAGED_CHALLENGE_RULE_REF,
    action: config.action,
    expression: buildManagedChallengeExpression(config),
    description: MANAGED_CHALLENGE_RULE_DESCRIPTION,
    enabled: true,
  };
}

/**
 * Merges the desired UWE rule into an existing rule list: foreign rules keep
 * their order and identity, the UWE rule is replaced in place (or appended when
 * new), and removed entirely when the challenge is not active.
 *
 * The rule is deliberately kept **last**: a `skip` rule the operator put in
 * front of it (e.g. for their own IP) then still wins, because Cloudflare
 * evaluates custom rules top-down.
 */
export function mergeManagedChallengeRule(
  existingRules: readonly CloudflareRule[],
  config: ManagedChallengeConfig,
): CloudflareRule[] {
  const foreign = existingRules.filter((rule) => !isManagedChallengeRule(rule));
  if (!hasActiveManagedChallenge(config)) {
    return foreign;
  }

  const previous = existingRules.find(isManagedChallengeRule);
  const rule = buildManagedChallengeRule(config);
  return [...foreign, previous?.id ? { ...rule, id: previous.id } : rule];
}
