/**
 * Zugangs-Tokens für den CalDAV-Server (iPhone-Kalender, lesen UND schreiben).
 *
 * Gleiches Muster wie die ICS-Abo-Tokens (`subscription-service.ts`), aber ein
 * eigener Typ mit eigenem Präfix: ein CalDAV-Zugang kann Termine des Haushalts
 * anlegen, ändern und löschen — anderes Risikoprofil als der read-only Feed,
 * eigener Widerruf. Der Client schickt das Token als HTTP-Basic-Passwort; der
 * Benutzername ist frei (Doku empfiehlt `familie`). Gespeichert wird nur der
 * Hash; Klartext gibt es genau einmal beim Anlegen.
 *
 * Bewusst ohne Personen-Bindung: der CalDAV-Zugang ist ein Haushalts-Zugang.
 */
import { randomBytes } from "node:crypto";
import { hashApiToken, verifyApiTokenHash } from "@uwe/auth/server";
import type { FamilyPrismaClient } from "@uwe/database/family-client";

/** Eigenes Präfix, damit ein CalDAV-Token nie mit Feed-/API-Tokens verwechselt wird. */
export const FAMILY_CALDAV_TOKEN_PREFIX = "uwedav_";

export interface CreateCalDavAccountInput {
  label: string;
}

export interface CreatedCalDavAccount {
  id: string;
  label: string;
  /** Nur hier im Klartext — danach nie wieder abrufbar. */
  token: string;
}

function generateCalDavToken(): string {
  return `${FAMILY_CALDAV_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

function tokenPrefixOf(token: string): string {
  return token.slice(0, FAMILY_CALDAV_TOKEN_PREFIX.length + 6);
}

export function isFamilyCalDavTokenFormat(token: string): boolean {
  return (
    token.startsWith(FAMILY_CALDAV_TOKEN_PREFIX) &&
    token.length > FAMILY_CALDAV_TOKEN_PREFIX.length + 16
  );
}

/**
 * Liest einen `Authorization: Basic …`-Header und gibt das Token zurück.
 * Der Benutzername wird ignoriert — die Identität steckt im Token selbst.
 */
export function tokenFromBasicAuth(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = header.trim().match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (!match?.[1]) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) return null;
  const password = decoded.slice(separator + 1);
  return password || null;
}

export class FamilyCalDavAccountService {
  constructor(private readonly db: FamilyPrismaClient) {}

  /** Alle Zugänge für die Verwaltungsansicht — ohne Klartext-Token. */
  async listAccounts() {
    return this.db.familyCalDavAccount.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAccount(input: CreateCalDavAccountInput): Promise<CreatedCalDavAccount> {
    const label = input.label.trim() || "iPhone-Kalender";
    const token = generateCalDavToken();

    const row = await this.db.familyCalDavAccount.create({
      data: {
        label: label.slice(0, 120),
        tokenHash: hashApiToken(token),
        tokenPrefix: tokenPrefixOf(token),
      },
    });

    return { id: row.id, label: row.label, token };
  }

  /**
   * Prüft ein Token. `null` ohne Unterschied zwischen „unbekannt" und
   * „widerrufen" — die 401-Antwort verrät nichts über die Existenz.
   */
  async resolveByToken(token: string) {
    if (!isFamilyCalDavTokenFormat(token)) return null;

    const candidate = await this.db.familyCalDavAccount.findUnique({
      where: { tokenHash: hashApiToken(token) },
    });
    if (!candidate || !candidate.isActive || candidate.revokedAt !== null) return null;

    // Zusätzlicher zeitkonstanter Vergleich wie beim Abo-Token.
    if (!verifyApiTokenHash(token, candidate.tokenHash)) return null;

    return candidate;
  }

  /** Bequemer Einstieg für die DAV-Route: Header rein, Zugang oder null raus. */
  async resolveBasicAuth(header: string | null | undefined) {
    const token = tokenFromBasicAuth(header);
    if (!token) return null;
    return this.resolveByToken(token);
  }

  /** Nutzung vermerken, damit verwaiste Zugänge erkennbar sind. */
  async markUsed(id: string) {
    await this.db.familyCalDavAccount.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeAccount(id: string) {
    return this.db.familyCalDavAccount.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async deleteAccount(id: string) {
    await this.db.familyCalDavAccount.delete({ where: { id } });
  }
}

export function createFamilyCalDavAccountService(
  db: FamilyPrismaClient,
): FamilyCalDavAccountService {
  return new FamilyCalDavAccountService(db);
}
