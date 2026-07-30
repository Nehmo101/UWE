/**
 * Abo-Tokens für den ICS-Kalender-Feed.
 *
 * Die Kalender-App auf dem iPhone abonniert eine URL und schickt dabei keinen
 * `Authorization`-Header — das Geheimnis muss also in der URL stehen. Genau
 * deshalb sind diese Tokens von `ApiToken` getrennt: anderes Risikoprofil
 * (steht im Klartext in der Abo-Liste des Geräts), eigener Widerruf, und sie
 * können ausschließlich Termine lesen.
 *
 * Der Token wird nur beim Anlegen im Klartext zurückgegeben; gespeichert wird
 * ausschließlich der Hash.
 */
import { randomBytes } from "node:crypto";
import { hashApiToken, verifyApiTokenHash } from "@uwe/auth/server";
import type { FamilyPrismaClient } from "@uwe/database/family-client";

/** Eigenes Präfix, damit ein Feed-Token nie mit einem API-Token verwechselt wird. */
export const FAMILY_CALENDAR_TOKEN_PREFIX = "uwecal_";

export interface CreateSubscriptionInput {
  label: string;
  /** Leer = alle Termine des Haushalts; gesetzt = nur die dieser Person. */
  memberId?: string | null;
}

export interface CreatedSubscription {
  id: string;
  label: string;
  memberId: string | null;
  /** Nur hier im Klartext — danach nie wieder abrufbar. */
  token: string;
}

function generateSubscriptionToken(): string {
  return `${FAMILY_CALENDAR_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

/** Die ersten Zeichen, um ein Abo in der Liste wiederzuerkennen. */
function tokenPrefixOf(token: string): string {
  return token.slice(0, FAMILY_CALENDAR_TOKEN_PREFIX.length + 6);
}

export function isFamilyCalendarTokenFormat(token: string): boolean {
  return (
    token.startsWith(FAMILY_CALENDAR_TOKEN_PREFIX) &&
    token.length > FAMILY_CALENDAR_TOKEN_PREFIX.length + 16
  );
}

export class FamilyCalendarSubscriptionService {
  constructor(private readonly db: FamilyPrismaClient) {}

  /** Alle Abos für die Verwaltungsansicht — ohne Klartext-Token. */
  async listSubscriptions() {
    return this.db.familyCalendarSubscription.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { member: { select: { id: true, displayName: true, colour: true } } },
    });
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const label = input.label.trim() || "Kalender-Abo";
    const token = generateSubscriptionToken();

    const row = await this.db.familyCalendarSubscription.create({
      data: {
        label: label.slice(0, 120),
        tokenHash: hashApiToken(token),
        tokenPrefix: tokenPrefixOf(token),
        memberId: input.memberId ?? null,
      },
    });

    return { id: row.id, label: row.label, memberId: row.memberId, token };
  }

  /**
   * Prüft einen Token aus der Feed-URL. Gibt das Abo zurück oder `null` —
   * ohne Unterschied zwischen „unbekannt" und „widerrufen", damit die Antwort
   * nichts über die Existenz eines Tokens verrät.
   */
  async resolveByToken(token: string) {
    if (!isFamilyCalendarTokenFormat(token)) return null;

    const candidate = await this.db.familyCalendarSubscription.findUnique({
      where: { tokenHash: hashApiToken(token) },
    });
    if (!candidate || !candidate.isActive || candidate.revokedAt !== null) return null;

    // Zusätzlicher zeitkonstanter Vergleich: der Lookup oben ist ein
    // Gleichheitstreffer auf dem Hash, der Vergleich hier schützt gegen
    // kuenftige Aenderungen am Speicherweg.
    if (!verifyApiTokenHash(token, candidate.tokenHash)) return null;

    return candidate;
  }

  /** Nutzung vermerken, damit ungenutzte Abos erkennbar sind. */
  async markUsed(id: string) {
    await this.db.familyCalendarSubscription.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeSubscription(id: string) {
    return this.db.familyCalendarSubscription.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async deleteSubscription(id: string) {
    await this.db.familyCalendarSubscription.delete({ where: { id } });
  }
}

export function createFamilyCalendarSubscriptionService(
  db: FamilyPrismaClient,
): FamilyCalendarSubscriptionService {
  return new FamilyCalendarSubscriptionService(db);
}
