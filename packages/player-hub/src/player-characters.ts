import type { AccessContext } from "@uwe/auth";
import { canReadWorld, scopeFromAccessContext } from "@uwe/auth";
import { pickUniqueSlug, slugifyDe } from "@uwe/shared-utils";
import {
  createPartyTreasuryService,
  DEFAULT_ABILITY_SCORES,
  type Prisma,
  type PrismaClient,
} from "@uwe/database/server";

import {
  CHARACTER_NAME_MAX,
  validateFullDraft,
  type CharacterDraftInput,
  type CreateFullCharacterResult,
} from "./character-draft-validation";

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
 *
 * Seit dem Charakter-Ersteller gibt es daneben `createFullCharacter`: derselbe
 * Weg, aber mit einem fertigen Entwurf statt eines einzelnen Namens. Beide
 * teilen sich Zugangsregel und Slug-Vergabe — es gibt genau eine Antwort auf
 * „wer darf hier anlegen", und die steht in `resolveWorldForCreation`.
 */

export interface CreateOwnCharacterInput {
  displayName: string;
}

export type CreateOwnCharacterResult =
  | { ok: true; characterId: string; pageSlug: string }
  | { ok: false; error: string };

export type CharacterMutationResult = { ok: true } | { ok: false; error: string };

export class PlayerCharacterService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Die eine Zugangsregel: angemeldet, keine Vorschau-Sitzung, der Welt
   * zugeordnet, Welt existiert und ist keine Sandbox, und lesbar.
   *
   * Beide Anlege-Wege rufen sie auf. Zwei Kopien derselben Regel wären genau
   * die Stelle, an der später eine davon nachgezogen wird und die andere
   * nicht.
   */
  private async resolveWorldForCreation(
    worldSlug: string,
    ctx: AccessContext,
  ): Promise<{ ok: true; worldId: string } | { ok: false; error: string }> {
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

    return { ok: true, worldId: world.id };
  }

  /** Ein freier Seiten-Slug in dieser Welt. */
  private async pickPageSlug(worldId: string, displayName: string): Promise<string> {
    const existing = await this.db.page.findMany({
      where: { worldId },
      select: { slug: true },
    });
    return pickUniqueSlug(
      slugifyDe(displayName, { fallback: "charakter", maxLength: 80 }),
      existing.map((page) => page.slug),
      { fallback: "charakter", maxLength: 80 },
    );
  }

  async createOwnCharacter(
    worldSlug: string,
    ctx: AccessContext,
    input: CreateOwnCharacterInput,
  ): Promise<CreateOwnCharacterResult> {
    const world = await this.resolveWorldForCreation(worldSlug, ctx);
    if (!world.ok) {
      return { ok: false, error: world.error };
    }

    const displayName = input.displayName.trim().slice(0, CHARACTER_NAME_MAX);
    if (!displayName) {
      return { ok: false, error: "Der Charakter braucht einen Namen." };
    }

    const slug = await this.pickPageSlug(world.worldId, displayName);
    const ownerUserId = ctx.user!.id;

    // Seite, Textblock und Bogen in EINER Transaktion: eine Seite ohne Bogen
    // wäre ein toter Eintrag in der Charakterliste, ein Bogen ohne Seite
    // unsichtbar.
    const created = await this.db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          worldId: world.worldId,
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
          worldId: world.worldId,
          pageId: page.id,
          ownerUserId,
          displayName,
          abilities: DEFAULT_ABILITY_SCORES as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      return { characterId: character.id, pageSlug: page.slug };
    });

    return { ok: true, ...created };
  }

  /**
   * Der fertige Charakter aus dem Ersteller.
   *
   * Alles, was `createOwnCharacter` anlegt, entsteht hier genauso — Seite mit
   * `portalReleased: true`, `player_text`-Block, Bogen ohne Kampagne. Dazu
   * kommen die Zahlen: Attribute, Trefferpunkte, Fertigkeiten, die vier
   * JSON-Spalten, die Zauber und die Startausrüstung.
   *
   * Und zwar in **einer** Transaktion. Ein Bogen ohne seine Ausrüstung wäre
   * kein halber Charakter, sondern ein falscher: der Spieler sieht einen
   * fertigen Bogen und merkt erst am Tisch, dass sein Schwert fehlt. Lieber
   * gar nichts anlegen und die Meldung zeigen.
   */
  async createFullCharacter(
    worldSlug: string,
    ctx: AccessContext,
    input: CharacterDraftInput,
  ): Promise<CreateFullCharacterResult> {
    const world = await this.resolveWorldForCreation(worldSlug, ctx);
    if (!world.ok) {
      return { ok: false, error: world.error, issues: [] };
    }

    const validated = validateFullDraft(input);
    if (!validated.ok) {
      return {
        ok: false,
        error: "Der Entwurf ist unvollständig oder passt nicht zu den Regeln.",
        issues: validated.issues,
      };
    }

    const value = validated.value;
    const displayName = value.draft.name;
    const slug = await this.pickPageSlug(world.worldId, displayName);
    const ownerUserId = ctx.user!.id;
    const worldId = world.worldId;
    const dndClass = value.catalog.dndClass;

    const created = await this.db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          worldId,
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
          worldId,
          pageId: page.id,
          ownerUserId,
          displayName,
          level: 1,
          abilities: value.scores as unknown as Prisma.InputJsonValue,
          classes: [{ name: dndClass.name, level: 1 }] as unknown as Prisma.InputJsonValue,
          skills: {
            proficiencies: value.skillProficiencies,
            expertise: [],
            savingThrows: dndClass.savingThrows,
          } as unknown as Prisma.InputJsonValue,
          combat: {
            maxHp: value.maxHp,
            currentHp: value.maxHp,
            armorClass: value.armorClass,
            initiativeBonus: 0,
            speed: value.speed,
          } as unknown as Prisma.InputJsonValue,
          spellcasting: {
            ability: dndClass.spellcasting?.ability ?? "none",
          } as unknown as Prisma.InputJsonValue,
          species: value.json.species as unknown as Prisma.InputJsonValue,
          background: value.json.background as unknown as Prisma.InputJsonValue,
          features: value.json.features as unknown as Prisma.InputJsonValue,
          bio: value.json.bio as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      // Zaubertricks und Zauber des 1. Grades. Beide gelten auf Stufe 1 als
      // vorbereitet — ob die Klasse „kennt" oder „bereitet vor", ändert erst
      // ab Stufe 2 etwas, und ein leerer Zauberblock auf dem frischen Bogen
      // wäre schlicht falsch.
      for (const spell of [...value.cantrips, ...value.spells]) {
        await tx.characterSpell.create({
          data: {
            characterId: character.id,
            spellKey: spell.key,
            spellLevel: spell.level,
            prepared: true,
            source: "class",
            displayName: spell.name,
            school: spell.school,
            description: spell.description,
          },
        });
      }

      // Die Startausrüstung geht durch denselben Weg wie jedes andere Item —
      // `addItem` kennt die Regel „Charakter ODER Gruppenschatz, nie beides".
      const inventory = createPartyTreasuryService(tx as PrismaClient);
      let sortOrder = 0;
      for (const item of value.startingItems) {
        await inventory.addItem({
          worldId,
          characterId: character.id,
          name: item.name,
          quantity: item.quantity,
          weight: item.weight,
          value: item.valueCp === null ? undefined : { cp: item.valueCp },
          notes: item.notes,
          sortOrder: sortOrder++,
        });
      }

      // Gold hat keine eigene Spalte am Charakter — der Gruppenschatz führt
      // die Währungen, ein Einzelbogen nicht. Als Gegenstand ist es sichtbar,
      // zählbar und kann ausgegeben werden, ohne dafür ein zweites
      // Währungsmodell zu erfinden.
      if (value.startingGold > 0) {
        await inventory.addItem({
          worldId,
          characterId: character.id,
          name: "Goldmünzen",
          quantity: value.startingGold,
          value: { gp: 1 },
          notes: "Startgold",
          sortOrder: sortOrder++,
        });
      }

      return { characterId: character.id, pageSlug: page.slug };
    });

    return { ok: true, ...created };
  }

  async duplicateOwnCharacter(
    worldSlug: string,
    ctx: AccessContext,
    characterId: string,
  ): Promise<CreateOwnCharacterResult> {
    const world = await this.resolveWorldForCreation(worldSlug, ctx);
    if (!world.ok) return { ok: false, error: world.error };
    const ownerUserId = ctx.user!.id;
    const source = await this.db.character.findFirst({
      where: { id: characterId, worldId: world.worldId, ownerUserId },
      include: {
        page: { include: { contentBlocks: { orderBy: { sortOrder: "asc" } } } },
        spells: true,
        inventoryItems: true,
      },
    });
    if (!source) return { ok: false, error: "Charakter nicht gefunden." };

    const displayName = `${source.displayName} (Kopie)`.slice(0, CHARACTER_NAME_MAX);
    const slug = await this.pickPageSlug(world.worldId, displayName);
    const created = await this.db.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          worldId: world.worldId,
          title: displayName,
          slug,
          type: "player_character",
          portalReleased: true,
        },
        select: { id: true, slug: true },
      });
      const playerText = source.page?.contentBlocks.find((block) => block.type === "player_text")?.content ?? "";
      await tx.contentBlock.create({
        data: { pageId: page.id, type: "player_text", sortOrder: 0, content: playerText },
      });
      const json = (value: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined =>
        value === null ? undefined : (value as Prisma.InputJsonValue);
      const character = await tx.character.create({
        data: {
          worldId: world.worldId,
          pageId: page.id,
          ownerUserId,
          displayName,
          rulesEdition: source.rulesEdition,
          level: source.level,
          abilities: source.abilities as Prisma.InputJsonValue,
          skills: json(source.skills),
          combat: json(source.combat),
          spellcasting: json(source.spellcasting),
          classes: json(source.classes),
          species: json(source.species),
          background: json(source.background),
          features: json(source.features),
          bio: json(source.bio),
          notes: source.notes,
        },
        select: { id: true },
      });
      if (source.spells.length > 0) {
        await tx.characterSpell.createMany({
          data: source.spells.map((spell) => ({
            characterId: character.id,
            spellKey: spell.spellKey,
            spellLevel: spell.spellLevel,
            prepared: spell.prepared,
            source: spell.source,
            displayName: spell.displayName,
            school: spell.school,
            description: spell.description,
            notes: spell.notes,
          })),
        });
      }
      if (source.inventoryItems.length > 0) {
        await tx.inventoryItem.createMany({
          data: source.inventoryItems.map((item) => ({
            worldId: world.worldId,
            characterId: character.id,
            pageId: null,
            name: item.name,
            quantity: item.quantity,
            weight: item.weight,
            value: json(item.value),
            properties: json(item.properties),
            notes: item.notes,
            sortOrder: item.sortOrder,
          })),
        });
      }
      return { characterId: character.id, pageSlug: page.slug };
    });
    return { ok: true, ...created };
  }

  async deleteOwnCharacter(
    worldSlug: string,
    ctx: AccessContext,
    characterId: string,
  ): Promise<CharacterMutationResult> {
    const world = await this.resolveWorldForCreation(worldSlug, ctx);
    if (!world.ok) return { ok: false, error: world.error };
    const ownerUserId = ctx.user!.id;
    const character = await this.db.character.findFirst({
      where: { id: characterId, worldId: world.worldId, ownerUserId },
      select: { id: true, pageId: true },
    });
    if (!character) return { ok: false, error: "Charakter nicht gefunden." };

    await this.db.$transaction(async (tx) => {
      await tx.character.delete({ where: { id: character.id } });
      if (character.pageId) {
        await tx.page.deleteMany({ where: { id: character.pageId, worldId: world.worldId } });
      }
    });
    return { ok: true };
  }
}

export function createPlayerCharacterService(db: PrismaClient): PlayerCharacterService {
  return new PlayerCharacterService(db);
}
