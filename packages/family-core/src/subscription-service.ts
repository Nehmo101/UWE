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
import { resolveMemberColour } from "./member-colours";
import {
  normaliseMemberIds,
  setMemberLinks,
  sortMemberBadges,
  type FamilyMemberBadge,
} from "./member-links";

/** Eigenes Präfix, damit ein Feed-Token nie mit einem API-Token verwechselt wird. */
export const FAMILY_CALENDAR_TOKEN_PREFIX = "uwecal_";

export interface CreateSubscriptionInput {
  label: string;
  /**
   * Leer = alle Termine des Haushalts; gesetzt = nur die dieser Personen. Ein
   * Abo darf auf mehrere lauten — ein Gerät, zwei Kinder.
   */
  memberIds?: readonly string[];
}

export interface CreatedSubscription {
  id: string;
  label: string;
  memberIds: string[];
  /** Nur hier im Klartext — danach nie wieder abrufbar. */
  token: string;
}

const MEMBER_LINK_SELECT = {
  select: { member: { select: { id: true, displayName: true, colour: true } } },
} as const;

function badgesOf(
  links: readonly { member: { id: string; displayName: string; colour: string } }[],
): FamilyMemberBadge[] {
  return sortMemberBadges(
    links.map((link) => ({
      id: link.member.id,
      displayName: link.member.displayName,
      colour: resolveMemberColour(link.member),
    })),
  );
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
    const rows = await this.db.familyCalendarSubscription.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: { memberLinks: MEMBER_LINK_SELECT },
    });

    return rows.map(({ memberLinks, ...rest }) => ({ ...rest, members: badgesOf(memberLinks) }));
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const label = input.label.trim() || "Kalender-Abo";
    const token = generateSubscriptionToken();
    const memberIds = normaliseMemberIds(input.memberIds ?? []);

    const row = await this.db.familyCalendarSubscription.create({
      data: {
        label: label.slice(0, 120),
        tokenHash: hashApiToken(token),
        tokenPrefix: tokenPrefixOf(token),
        memberLinks: { create: memberIds.map((memberId) => ({ memberId })) },
      },
    });

    return { id: row.id, label: row.label, memberIds, token };
  }

  /**
   * Setzt die Personen eines Abos auf genau diese Menge. Leer heisst wieder
   * „ganzer Haushalt" — das ist die Ausweitung, die der Aufrufer bewusst
   * treffen muss.
   */
  async setSubscriptionMembers(id: string, memberIds: readonly string[]): Promise<string[]> {
    return setMemberLinks(
      {
        listMemberIds: async (subscriptionId) =>
          (
            await this.db.familyCalendarSubscriptionMember.findMany({
              where: { subscriptionId },
              select: { memberId: true },
            })
          ).map((link) => link.memberId),
        removeExcept: async (subscriptionId, keep) => {
          await this.db.familyCalendarSubscriptionMember.deleteMany({
            where:
              keep.length > 0
                ? { subscriptionId, memberId: { notIn: [...keep] } }
                : { subscriptionId },
          });
        },
        add: async (subscriptionId, ids) => {
          await this.db.familyCalendarSubscriptionMember.createMany({
            data: ids.map((memberId) => ({ subscriptionId, memberId })),
          });
        },
      },
      id,
      memberIds,
    );
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
      include: { memberLinks: { select: { memberId: true } } },
    });
    if (!candidate || !candidate.isActive || candidate.revokedAt !== null) return null;

    // Zusätzlicher zeitkonstanter Vergleich: der Lookup oben ist ein
    // Gleichheitstreffer auf dem Hash, der Vergleich hier schützt gegen
    // kuenftige Aenderungen am Speicherweg.
    if (!verifyApiTokenHash(token, candidate.tokenHash)) return null;

    const { memberLinks, ...rest } = candidate;
    // Leer heisst „ganzer Haushalt" — der Feed filtert dann nichts weg.
    return { ...rest, memberIds: memberLinks.map((link) => link.memberId) };
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
