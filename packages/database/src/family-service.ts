import type { FamilyPrismaClient } from "./family-client";
import type { FamilyChatRole, FamilyChatScope } from "./generated/prisma-family/client";

/**
 * Family-Daten: die beiden Chats, das daraus wachsende Wissen und die
 * Mitglieder-Profile.
 *
 * Der Kern ist die Sichtbarkeitsregel und sie steht genau hier, damit sie nicht
 * in jeder Seite neu erfunden wird:
 *
 *   scope = "shared"  → `ownerUserId` ist null, alle mit dem Häkchen sehen es
 *   scope = "private" → `ownerUserId` ist gesetzt, nur diese Person sieht es
 *
 * Es gibt keine dritte Stufe. „Nur für Erwachsene" o. ä. wäre wieder eine
 * Sichtbarkeitsmatrix, und die ist bewusst abgeschafft (Notiz Lasse, N.2) —
 * die Trennung läuft über Eigentum, nicht über Labels.
 *
 * Der Owner ist der Sonderfall: sein *privates* Wissen gehört ins Owner-Brain
 * (`uwe-brain.db`), nicht hierher (G.2b). Diese Klasse weiß davon nichts; der
 * Aufrufer entscheidet, welchen Speicher er nimmt.
 */

export interface FamilyChatVisibility {
  scope: FamilyChatScope;
  /** Muss bei `private` gesetzt sein, bei `shared` null. */
  ownerUserId: string | null;
}

export class FamilyService {
  constructor(private readonly db: FamilyPrismaClient) {}

  /**
   * Der Where-Filter für alles, was eine Person sehen darf: das Geteilte plus
   * das eigene Private. Fremdes Privates ist damit strukturell unerreichbar.
   */
  private visibleTo(userId: string) {
    return {
      OR: [{ scope: "shared" as const }, { scope: "private" as const, ownerUserId: userId }],
    };
  }

  /* ── Unterhaltungen ─────────────────────────────────────────────────── */

  async listConversations(userId: string, scope?: FamilyChatScope) {
    return this.db.familyChatConversation.findMany({
      where: scope
        ? scope === "shared"
          ? { scope: "shared" }
          : { scope: "private", ownerUserId: userId }
        : this.visibleTo(userId),
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.db.familyChatConversation.findUnique({ where: { id } });
    if (!conversation) return null;
    // Nachträglicher Eigentums-Check statt Filter im Query: eine fremde private
    // Unterhaltung darf sich nicht einmal durch ihre Existenz verraten.
    if (conversation.scope === "private" && conversation.ownerUserId !== userId) return null;
    return conversation;
  }

  async createConversation(input: { title: string; scope: FamilyChatScope; userId: string }) {
    return this.db.familyChatConversation.create({
      data: {
        title: input.title,
        scope: input.scope,
        ownerUserId: input.scope === "private" ? input.userId : null,
      },
    });
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return false;
    await this.db.familyChatConversation.delete({ where: { id } });
    return true;
  }

  /* ── Nachrichten ────────────────────────────────────────────────────── */

  async listMessages(conversationId: string, userId: string) {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return [];
    return this.db.familyChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async appendMessage(input: {
    conversationId: string;
    userId: string;
    role: FamilyChatRole;
    content: string;
    model?: string | null;
    errorMessage?: string | null;
    durationMs?: number | null;
  }) {
    const conversation = await this.getConversation(input.conversationId, input.userId);
    if (!conversation) return null;

    const message = await this.db.familyChatMessage.create({
      data: {
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        model: input.model ?? null,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
      },
    });
    // `updatedAt` ist die Sortierung der Unterhaltungsliste — ohne diesen
    // Anstoss rutscht ein aktiver Chat nach unten.
    await this.db.familyChatConversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  /* ── Wissen ─────────────────────────────────────────────────────────── */

  async listFacts(userId: string, scope?: FamilyChatScope) {
    return this.db.familyBrainFact.findMany({
      where:
        scope === "shared"
          ? { ownerUserId: null }
          : scope === "private"
            ? { ownerUserId: userId }
            : { OR: [{ ownerUserId: null }, { ownerUserId: userId }] },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async createFact(input: {
    title: string;
    content: string;
    scope: FamilyChatScope;
    userId: string;
    tags?: string[];
    source?: string;
  }) {
    return this.db.familyBrainFact.create({
      data: {
        title: input.title,
        content: input.content,
        ownerUserId: input.scope === "private" ? input.userId : null,
        tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
        source: input.source ?? "chat",
      },
    });
  }

  async deleteFact(id: string, userId: string): Promise<boolean> {
    const fact = await this.db.familyBrainFact.findUnique({ where: { id } });
    if (!fact) return false;
    if (fact.ownerUserId !== null && fact.ownerUserId !== userId) return false;
    await this.db.familyBrainFact.delete({ where: { id } });
    return true;
  }

  /* ── Mitglieder ─────────────────────────────────────────────────────── */
  // Mitglieder liegen jetzt in `@uwe/family-core` (`FamilyMemberService`): ein
  // Mitglied ist dort eine Person mit oder ohne Konto, nicht mehr nur ein
  // Profil zu einer Benutzer-ID. Dieser Service bleibt bei Chat und Wissen.
}

export function createFamilyService(db: FamilyPrismaClient): FamilyService {
  return new FamilyService(db);
}

export type { FamilyChatRole, FamilyChatScope };
