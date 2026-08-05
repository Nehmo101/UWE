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
 * - `dav/[[...segments]]/route.ts` — CalDAV-Server für den iPhone-Kalender
 *   (lesen und schreiben). Der Client authentifiziert per HTTP Basic mit einem
 *   eigenen Token-Typ (`uwedav_…`, Modell `FamilyCalDavAccount`), nur als Hash
 *   gespeichert und einzeln widerrufbar; geprüft im Handler. Cookies werden
 *   nie ausgewertet — CSRF greift deshalb nicht. Ohne gültigen Token: 401 mit
 *   `WWW-Authenticate`, wie es das Basic-Schema verlangt.
 */
export const FAMILY_PUBLIC_API_ALLOWLIST = new Set([
  "health/route.ts",
  "calendar/feed/[token]/route.ts",
  "dav/[[...segments]]/route.ts",
]);

/**
 * Family-2FA-Routen, die ihre Prüfung an
 * `apps/family/src/lib/two-factor-routes.ts` abgeben (dort ruft
 * `createTwoFactorRouteHandlers` den Häkchen-Guard). `verify` schützt sich
 * selbst und fehlt hier deshalb bewusst — genau wie in Portal.
 */
export const FAMILY_TWO_FACTOR_DELEGATED_ROUTES = new Set([
  "auth/two-factor/route.ts",
  "auth/two-factor/setup/route.ts",
  "auth/two-factor/activate/route.ts",
  "auth/two-factor/disable/route.ts",
]);

/**
 * Family-Passkey-Routen, die an `apps/family/src/lib/passkey-routes.ts`
 * abgeben. Die Verwaltungs-Endpunkte sind dort sitzungsgebunden; die
 * Login-Endpunkte sind wie `/api/auth/login` absichtlich öffentlich und
 * setzen das Sitzungs-Cookie im selben Helfer. Ohne sie könnte sich niemand
 * per FaceID anmelden — die Anmeldung ist ja gerade das, was noch fehlt.
 */
export const FAMILY_PASSKEY_DELEGATED_ROUTES = new Set([
  "auth/passkey/login/options/route.ts",
  "auth/passkey/login/verify/route.ts",
  "auth/passkey/register/options/route.ts",
  "auth/passkey/register/verify/route.ts",
  "auth/passkey/credentials/route.ts",
  "auth/passkey/credentials/[id]/route.ts",
]);

export function listFamilyApiRouteFiles(repoRoot: string): string[] {
  return listApiRouteFiles(path.join(repoRoot, FAMILY_API_ROOT));
}

function familyPolicy(repoRoot: string): RouteProtectionPolicy {
  return {
    guardPattern: FAMILY_AUTH_GUARD_PATTERN,
    publicAllowlist: FAMILY_PUBLIC_API_ALLOWLIST,
    delegatedGroups: [
      {
        routes: FAMILY_TWO_FACTOR_DELEGATED_ROUTES,
        helperPath: path.join(repoRoot, "apps/family/src/lib/two-factor-routes.ts"),
      },
      {
        routes: FAMILY_PASSKEY_DELEGATED_ROUTES,
        helperPath: path.join(repoRoot, "apps/family/src/lib/passkey-routes.ts"),
      },
    ],
  };
}

export function assertFamilyRouteProtected(repoRoot: string, relativeRoute: string): void {
  assertRouteProtected(
    path.join(repoRoot, FAMILY_API_ROOT),
    relativeRoute,
    familyPolicy(repoRoot),
  );
}
