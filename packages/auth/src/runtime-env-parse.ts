/**
 * Parser und Normalisierer für Laufzeit-Umgebungswerte.
 *
 * Aus `runtime-config.ts` herausgezogen, das damit wieder unter dem
 * Zeilenbudget liegt (siehe CLAUDE.md § Modul-Disziplin). Bewusst nur
 * Blattfunktionen ohne Rückgriff auf `getUweRuntimeConfig` oder die
 * URL-Auflösung — dadurch entsteht kein Importzyklus, und das Verhalten ist
 * unverändert: die Funktionen sind wortgleich übernommen.
 *
 * Alle Funktionen sind rein und tolerant: ungültige Eingaben führen nie zu
 * einer Ausnahme, sondern auf den sicheren Vorgabewert. Eine kaputte
 * Umgebungsvariable darf den Prozess nicht daran hindern, hochzufahren.
 */

export type SessionCookieSameSite = "lax" | "strict" | "none";

export function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return defaultValue;
}

/**
 * Parse a positive integer env value (e.g. TRUSTED_PROXY_HOPS). Anything
 * missing, non-numeric or < 1 falls back to the safe default — a broken value
 * must never crash boot.
 */
export function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
}

export function parseSameSite(value: string | undefined): SessionCookieSameSite {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict" || normalized === "none") {
    return normalized;
  }
  return "lax";
}

/**
 * Normalize SESSION_COOKIE_DOMAIN. Empty/unset → null (host-only cookie).
 * Accepts `example.org` or `.example.org` (leading dot = all subdomains).
 */
export function normalizeCookieDomain(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  // Guard against obvious mistakes (scheme, path, port, whitespace).
  if (/[/:\s]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function parseAllowedCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  const origins: string[] = [];
  for (const part of value.split(",")) {
    const origin = part.trim();
    if (!origin) {
      continue;
    }

    try {
      origins.push(new URL(origin).toString().replace(/\/$/, ""));
    } catch {
      // ignore invalid origins — default remains same-origin only
    }
  }

  return origins;
}

export function normalizePublicAppUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Schneidet abschließende Schrägstriche ab — bewusst als Schleife, nicht als
 * `replace(/\/+$/, "")`.
 *
 * Der Regex mit `+` vor dem Anker läuft auf einer Kette aus lauter
 * Schrägstrichen quadratisch: die Engine setzt an jeder Position neu an
 * (polynomialer ReDoS, CodeQL `js/polynomial-redos`). Der Wert kommt zwar aus
 * der Umgebung und nicht von einem Besucher — aber diese Datei ist die
 * Eingangstür für jeden Env-Wert, und eine Schleife ist hier weder länger noch
 * unklarer als der Regex.
 */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) {
    end -= 1;
  }
  return value.slice(0, end);
}

export function normalizeAppPath(
  value: string | undefined,
  fallback: string,
  options?: { allowRoot?: boolean },
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed === "/") {
    return options?.allowRoot ? "/" : fallback;
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return stripTrailingSlashes(withLeading) || fallback;
}

export function parsePublicUrlHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isLoopbackUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
