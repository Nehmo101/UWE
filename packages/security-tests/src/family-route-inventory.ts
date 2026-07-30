import path from "node:path";
import {
  assertRouteProtected,
  listApiRouteFiles,
  type RouteProtectionPolicy,
} from "./route-inventory-core";

export const FAMILY_API_ROOT = "apps/family/app/api";

/**
 * Family-Routen kennen genau einen Guard: `requireFamilyApiAuth`. Es gibt keine
 * Rollen und keine Welt-Zuordnung in Family — entweder die Adresse trägt das
 * Häkchen `Family`, oder nicht.
 */
export const FAMILY_AUTH_GUARD_PATTERN = /requireFamilyApiAuth/;

/**
 * Absichtlich öffentliche Family-Endpunkte.
 *
 * - `health/route.ts` — Lebenszeichen ohne DB-, Migrations- oder Config-Detail.
 *   Steht auch in FAMILY_PUBLIC_ROUTES (route-policy.ts).
 * - `calendar/feed/[token]/route.ts` — ICS-Abo für die Kalender-App auf dem
 *   Handy. Ein Abo-Kalender wird ohne `Authorization`-Header abgerufen, das
 *   Geheimnis steht deshalb im Pfad: ein eigener Token-Typ (`uwecal_…`,
 *   Modell `FamilyCalendarSubscription`), der ausschliesslich Termine lesen
 *   kann, einzeln widerrufbar ist und nur als Hash gespeichert wird. Ein
 *   unbekannter oder widerrufener Token bekommt 404, damit die Antwort nichts
 *   über die Existenz eines Tokens verrät.
 */
export const FAMILY_PUBLIC_API_ALLOWLIST = new Set([
  "health/route.ts",
  "calendar/feed/[token]/route.ts",
]);

export function listFamilyApiRouteFiles(repoRoot: string): string[] {
  return listApiRouteFiles(path.join(repoRoot, FAMILY_API_ROOT));
}

function familyPolicy(): RouteProtectionPolicy {
  return {
    guardPattern: FAMILY_AUTH_GUARD_PATTERN,
    publicAllowlist: FAMILY_PUBLIC_API_ALLOWLIST,
  };
}

export function assertFamilyRouteProtected(repoRoot: string, relativeRoute: string): void {
  assertRouteProtected(path.join(repoRoot, FAMILY_API_ROOT), relativeRoute, familyPolicy());
}
