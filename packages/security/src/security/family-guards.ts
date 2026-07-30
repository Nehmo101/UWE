import type { ApiTokenScope } from "@uwe/auth";
import { hasApiTokenScope } from "@uwe/auth";
import { isCrossSiteBrowserRequest } from "./csrf";
import { csrfError, forbidden, unauthorized } from "./errors";
import { enforceRateLimit, type RateLimitPreset } from "./rate-limit";
import type { ApiAuthContext } from "./guards";

/**
 * Zugangsprüfung für Family-API-Routen.
 *
 * Family kennt zwei Aufrufer: den Browser der Haushalts-Mitglieder (Sitzung +
 * Häkchen `Family`) und externe Clients mit einem API-Token. Beide laufen durch
 * dieselbe Prüfung, damit es nicht zwei Wahrheiten gibt.
 *
 * Eigene Datei statt Anbau an `guards.ts` — das Sammelbecken ist voll genug.
 *
 * Anders als in Studio gibt es hier keine Rollen und keine Welt-Zuordnung:
 * entweder die Adresse trägt das Häkchen, oder nicht. Bei Tokens entscheiden
 * die Scopes.
 */

export interface FamilyGuardOptions {
  /** Scopes, die ein API-Token mitbringen muss. Für Sitzungen ohne Bedeutung. */
  requiredScopes?: readonly ApiTokenScope[];
  rateLimit?: RateLimitPreset;
  rateLimitKey?: string;
}

/** Lesende Methoden brauchen keinen CSRF-Schutz. */
function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

/**
 * Prüft einen aufgelösten Auth-Kontext gegen die Anforderungen der Route.
 * Gibt `null` zurück, wenn alles passt — sonst die fertige Fehlerantwort.
 */
export function requireFamilyApiAuthContext(
  request: Request,
  context: ApiAuthContext,
  options: FamilyGuardOptions = {},
): Response | null {
  if (!isReadMethod(request.method) && isCrossSiteBrowserRequest(request)) {
    return csrfError();
  }

  if (options.rateLimit) {
    const limited = enforceRateLimit(
      request,
      `family:${options.rateLimit}`,
      options.rateLimit,
      options.rateLimitKey,
    );
    if (limited) return limited;
  }

  if (context.authMethod === "api_token") {
    const granted = context.apiTokenScopes ?? [];
    const required = options.requiredScopes ?? [];

    // Ein Token ohne die geforderten Scopes ist wie kein Token — aber die
    // Auskunft ist 403, nicht 401: es ist authentifiziert, nur nicht befugt.
    if (required.length > 0 && !hasApiTokenScope(granted, required)) {
      return forbidden("Dem Token fehlt die nötige Berechtigung.");
    }
    return null;
  }

  if (context.authMethod === "session") {
    if (!context.user) {
      return unauthorized("Anmeldung erforderlich.");
    }
    if (!context.user.access.family && !context.user.isOwner) {
      return forbidden("Kein Zugang zum Bereich Family.");
    }
    return null;
  }

  return unauthorized("Anmeldung erforderlich.");
}
