import path from "node:path";
import {
  assertRouteProtected,
  listApiRouteFiles,
  type RouteProtectionPolicy,
} from "./route-inventory-core";

export const BRAIN_API_ROOT = "apps/brain/app/api";

/**
 * Brain kennt drei Guards, alle mit derselben Aussage: die angemeldete Adresse
 * trägt das Häkchen `Brain`.
 *
 * - `requireBrainOwnerAuth` — der Grundfall für einzelne Routen.
 * - `guardAssistantApi` — KI-Chat, zusätzlich Same-Origin und Rate-Limit.
 * - `requireBrainMailApi` / `requireBrainMailMutation` — Mail-Center (H10),
 *   ebenfalls mit Same-Origin und Rate-Limit bei Mutationen.
 * - `requireBrainMailAi` — Mail-Routen, die den Maschinenraum-Host beschäftigen (G-KI).
 *   Es ruft `requireBrainMailMutation` in sich auf und verlangt zusätzlich das
 *   KI-Flag; es ist damit die STRENGERE Variante, keine Alternative.
 *
 * Rollen und Welt-Zuordnung gibt es hier nicht: Brain ist owner-privat, das
 * Häkchen ist die ganze Prüfung — beim KI-Flag kommt die Frage dazu, ob die
 * Adresse den Maschinenraum-Host überhaupt beschäftigen darf.
 */
export const BRAIN_AUTH_GUARD_PATTERN =
  /requireBrainOwnerAuth|guardAssistantApi|requireBrainMail(?:Api|Mutation|Ai)/;

/**
 * Absichtlich öffentliche Brain-Endpunkte.
 *
 * - `health/route.ts` — Lebenszeichen ohne DB-, Migrations- oder Config-Detail.
 *   Alles Aussagekräftige liegt hinter `health/private`.
 */
export const BRAIN_PUBLIC_API_ALLOWLIST = new Set(["health/route.ts"]);

export function listBrainApiRouteFiles(repoRoot: string): string[] {
  return listApiRouteFiles(path.join(repoRoot, BRAIN_API_ROOT));
}

function brainPolicy(): RouteProtectionPolicy {
  return {
    guardPattern: BRAIN_AUTH_GUARD_PATTERN,
    publicAllowlist: BRAIN_PUBLIC_API_ALLOWLIST,
  };
}

export function assertBrainRouteProtected(repoRoot: string, relativeRoute: string): void {
  assertRouteProtected(path.join(repoRoot, BRAIN_API_ROOT), relativeRoute, brainPolicy());
}
