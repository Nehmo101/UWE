/**
 * Client-sicherer Teil des Spieler-Bereichs.
 *
 * Beschriftungen, Aufzählungen und reine Formen — alles, was eine
 * `"use client"`-Komponente braucht, um Verfügbarkeiten anzuzeigen, und nichts
 * davon berührt die Datenbank.
 *
 * **Warum als eigene Datei:** `availability.ts` enthält daneben den Dienst, und
 * das Paket-Barrel `@uwe/player-hub` zieht über `player-characters.ts` den
 * server-only Einstieg `@uwe/database/server` herein. Der wiederum bringt
 * `@uwe/assets` mit — und damit `adm-zip` und `sharp`. Eine Client-Komponente,
 * die das Barrel importiert, nimmt diese Kette mit in ihr Bündel, und
 * `next build` bricht mit „Module not found: Can't resolve 'fs'" ab. Genau so
 * stand `main` am 2026-08-05 vier Läufe lang rot.
 *
 * Dasselbe Muster gibt es schon bei `@uwe/mail-core/portal-types`. Wer im
 * Client etwas aus dem Spieler-Bereich braucht, importiert
 * `@uwe/player-hub/portal-types` — nie das Barrel.
 */

export const AVAILABILITY_STATUSES = ["yes", "maybe", "no"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  yes: "Bin dabei",
  maybe: "Vielleicht",
  no: "Kann nicht",
};

export function normalizeAvailabilityStatus(
  raw: string | null | undefined,
): AvailabilityStatus | null {
  const value = raw?.trim().toLowerCase();
  return (AVAILABILITY_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as AvailabilityStatus)
    : null;
}

export interface AvailabilityVote {
  userId: string;
  displayName: string;
  status: AvailabilityStatus;
  note: string | null;
  updatedAt: Date;
}

export interface SessionAvailabilitySummary {
  sessionId: string;
  votes: AvailabilityVote[];
  counts: Record<AvailabilityStatus, number>;
}
