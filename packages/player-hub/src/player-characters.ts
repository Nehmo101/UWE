import type { AccessContext } from "@uwe/auth";
import { canReadWorld, scopeFromAccessContext } from "@uwe/auth";
import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils";
import { DEFAULT_ABILITY_SCORES, type Prisma, type PrismaClient } from "@uwe/database/server";

/**
 * Charaktere aus Spielerhand — das Anlegen im Portal.
 *
 * Bis zu dieser Runde legte der Spielleiter Charakterbögen im Studio an
 * („Charakterbogen erstellen" auf einer Spielercharakter-Seite). Das ist die
 * falsche Küche: der Charakter gehört dem Spieler. Ab jetzt legt der Spieler
 * ihn selbst an — mitsamt Wiki-Seite und leerem Bogen — und der Spielleiter
 * behält genau die eine Entscheidung, die ihm gehört: die Zuweisung zur
 * Kampagne (im Kampagnen-Cockpit, `assignCharacterToCampaignAction`).
 *
 * Was dabei entsteht:
 *
 *   1. Eine Wiki-Seite vom Typ `player_character`, `portalReleased: true` —
 *      die einzige Seitenart, die das Portal je anlegt. Sie ist sofort
 *      sichtbar, denn ein Charakter, den sein eigener Spieler nicht sehen
 *      kann, wäre absurd; und sie enthält einen leeren `player_text`-Block,
 *      den genau dieser Spieler beschreiben darf
 *      (`canEditPlayerCharacterBlock`).
 *   2. Ein Character-Datensatz mit Standardwerten (Stufe 1, Attribute 10),
 *      dem Konto des Spielers als Besitzer und OHNE Kampagne.
 *
 * Wer darf das: dieselbe Regel wie beim Kartenbau (`canCreateTerraKarte`) —
 * die Welt-Zuordnung entscheidet, Vorschau-Sitzungen sind draußen.
 */

export interface CreateOwnCharacterInput {
  displayName: string;
}

export type CreateOwnCharacterResult =
  | { ok: true; characterId: string; pageSlug: string }
  | { ok: false; error: string };

const NAME_MAX = 120;

export class PlayerCharacterService {
  constructor(private readonly db: PrismaClient) {}

  async createOwnCharacter(
    worldSlug: string,
    ctx: AccessContext,
    input: CreateOwnCharacterInput,
  ): Promise<CreateOwnCharacterResult> {
    if (!ctx.user || ctx.previewAsUserId || ctx.worldMembership === null) {
      return { ok: false, error: "Keine Berechtigung, in dieser Welt Charaktere anzulegen." };
    }

    const world = await this.db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, isSandbox: true },
    });
    if (!world || world.isSandbox) {
      return { ok: false, error: "Welt nicht gefunden." };
    }

    const scope = scopeFromAccessContext(ctx, world.id);
    if (!canReadWorld(ctx.user, scope.world, scope)) {
      return { ok: false, error: "Welt nicht gefunden." };
    }

    const displayName = input.displayName.trim().slice(0, NAME_MAX);
    if (!displayName) {
      return { ok: false, error: "Der Charakter braucht einen Namen." };
    }

    const existing = await this.db.page.findMany({
      where: { worldId: world.id },
      select: { slug: true },
    });
    const slug = pickUniqueSlug(
      slugifyDe(displayName, { fallback: "charakter", maxLength: 80 }),
      existing.map((page) => page.slug),
      { fallback: "charakter", maxLength: 80 },
    );

    // Seite, Textblock und Bogen in EINER Transaktion: eine Seite ohne Bogen
    // wäre ein toter Eintrag in der Charakterliste, ein Bogen ohne Seite
    // unsichtbar.
    const created = await this.db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          worldId: world.id,
          title: displayName,
          slug,
          type: "player_character",
          portalReleased: true,
        },
        select: { id: true, slug: true },
      });

      await tx.contentBlock.create({
        data: {
          pageId: page.id,
          type: "player_text",
          sortOrder: 0,
          content: "",
        },
      });

      const character = await tx.character.create({
        data: {
          worldId: world.id,
          pageId: page.id,
          ownerUserId: ctx.user!.id,
          displayName,
          abilities: DEFAULT_ABILITY_SCORES as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      return { characterId: character.id, pageSlug: page.slug };
    });

    return { ok: true, ...created };
  }
}

export function createPlayerCharacterService(db: PrismaClient): PlayerCharacterService {
  return new PlayerCharacterService(db);
}
