import { classifyInferenceUrl, isInferenceUrlAllowed } from "./inference/inference-url-guard";

export class SsrfBlockedError extends Error {
  constructor(
    message: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Standard-Allowlist für ausgehende KI-Anfragen: leer.
 *
 * Bis N.3 standen hier die Cloud-Anbieter. UWE spricht nur noch den eigenen
 * Maschinenraum-Host an, und der ist per Definition kein öffentlicher Host — eine
 * Vorgabe-Erlaubnis für fremde Domains wäre also genau die Tür, die zu bleiben
 * hat. Wer bewusst eine öffentliche Adresse braucht, setzt `AI_FETCH_ALLOWLIST`.
 */
const DEFAULT_ALLOWED_FETCH_HOSTS: string[] = [];

function parseHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveAiFetchAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.AI_FETCH_ALLOWLIST?.trim();
  if (!raw) {
    return DEFAULT_ALLOWED_FETCH_HOSTS;
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isBlockedUserFetchTarget(url: string, allowPublicInference = false): boolean {
  const hostname = parseHostname(url);
  if (!hostname) {
    return true;
  }

  const kind = classifyInferenceUrl(url);
  if (kind === "loopback" || kind === "private" || kind === "link_local") {
    return true;
  }

  if (!allowPublicInference && !isInferenceUrlAllowed(url, false)) {
    return true;
  }

  return false;
}

/**
 * Validates URLs for user-provided external feed fetches (iCal, CalDAV, webhooks).
 * Blocks localhost/private targets; allows any public http(s) hostname.
 */
export function assertUserProvidedFetchUrlAllowed(url: string): void {
  let protocol = "";
  try {
    protocol = new URL(url).protocol.toLowerCase();
  } catch {
    throw new SsrfBlockedError("Ungültige URL — Fetch blockiert.", url);
  }

  if (protocol !== "https:" && protocol !== "http:") {
    throw new SsrfBlockedError("Nur http(s)-URLs sind erlaubt.", url);
  }

  const kind = classifyInferenceUrl(url);
  if (kind === "loopback" || kind === "private" || kind === "link_local") {
    throw new SsrfBlockedError(
      "Fetch auf localhost oder private Netzwerk-Adressen ist nicht erlaubt.",
      url,
    );
  }
}

export function assertFetchUrlAllowed(
  url: string,
  options?: {
    allowlist?: string[];
    allowPrivateInference?: boolean;
    env?: NodeJS.ProcessEnv;
  },
): void {
  const env = options?.env ?? process.env;
  const allowlist = options?.allowlist ?? resolveAiFetchAllowlist(env);
  const hostname = parseHostname(url);

  if (!hostname) {
    throw new SsrfBlockedError("Ungültige URL — Fetch blockiert.", url);
  }

  if (isBlockedUserFetchTarget(url, options?.allowPrivateInference ?? false)) {
    throw new SsrfBlockedError(
      "Fetch auf localhost oder private Netzwerk-Adressen ist nicht erlaubt.",
      url,
    );
  }

  const allowed = allowlist.some(
    (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
  );

  if (!allowed) {
    throw new SsrfBlockedError(
      `Fetch auf ${hostname} ist nicht in der AI-Allowlist.`,
      url,
    );
  }
}
