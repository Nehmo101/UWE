import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  abilityModifier,
  buildCharacterSheetSnapshot,
  createCharacterService,
  DEFAULT_ABILITY_SCORES,
  parseAbilityScores,
  parseCharacterCombat,
  proficiencyBonus,
} from "./character-service";
import {
  createPartyTreasuryService,
  DEFAULT_CURRENCIES,
} from "./party-treasury-service";

describe("wave c0b character and inventory models", () => {
  let databaseUrl: string;
  let worldId: string;
  let userId: string;
  let pageId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Sheet Test", slug: "sheet-test" });
    worldId = world.id;

    const user = await db.user.create({
      data: {
        displayName: "Player One",
        email: "player-sheet@test.local",
        role: "player",
      },
    });
    userId = user.id;

    const page = await repo.createPage({
      worldId,
      title: "Aria",
      slug: "aria",
      type: "player_character",
    });
    pageId = page.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("creates multiple characters per player in a world", async () => {
    const db = createPrismaClient(databaseUrl);
    const characters = createCharacterService(db);
    const first = await characters.create({
      worldId,
      ownerUserId: userId,
      displayName: "Aria",
      pageId,
    });
    const second = await characters.create({
      worldId,
      ownerUserId: userId,
      displayName: "Backup PC",
    });

    const owned = await characters.listForOwner(worldId, userId);
    assert.equal(owned.length, 2);
    assert.deepEqual(first.abilities, DEFAULT_ABILITY_SCORES);
    assert.equal(second.displayName, "Backup PC");
    await db.$disconnect();
  });

  it("upserts character spells", async () => {
    const db = createPrismaClient(databaseUrl);
    const characters = createCharacterService(db);
    const [character] = await characters.listForOwner(worldId, userId);
    assert.ok(character);

    await characters.upsertSpell({
      characterId: character.id,
      spellKey: "fire-bolt",
      spellLevel: 0,
      prepared: true,
    });

    const loaded = await characters.getById(character.id);
    assert.equal(loaded?.spells.length, 1);
    assert.equal(loaded?.spells[0]?.spellKey, "fire-bolt");
    await db.$disconnect();
  });

  it("creates party treasury with currency and items", async () => {
    const db = createPrismaClient(databaseUrl);
    const treasury = createPartyTreasuryService(db);
    const record = await treasury.getOrCreateForWorld(worldId);
    assert.deepEqual(record.currencies, DEFAULT_CURRENCIES);

    await treasury.upsert({
      worldId,
      currencies: { ...DEFAULT_CURRENCIES, gp: 250 },
    });

    const item = await treasury.addItem({
      worldId,
      treasuryId: record.id,
      name: "Heiltrank",
      quantity: 3,
      value: { gp: 50 },
    });
    assert.equal(item.name, "Heiltrank");

    const items = await treasury.listItemsForTreasury(record.id);
    assert.equal(items.length, 1);
    await db.$disconnect();
  });

  it("computes basic 2024 modifiers", () => {
    assert.equal(abilityModifier(16), 3);
    assert.equal(proficiencyBonus(5), 3);
  });

  it("parses ability scores with defaults and clamps values", () => {
    assert.deepEqual(parseAbilityScores(null), DEFAULT_ABILITY_SCORES);
    assert.deepEqual(
      parseAbilityScores({
        strength: 18,
        dexterity: 14,
        constitution: 99,
      }),
      {
        strength: 18,
        dexterity: 14,
        constitution: 30,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    );
  });

  it("builds sheet snapshot with initiative from combat JSON", async () => {
    const db = createPrismaClient(databaseUrl);
    const characters = createCharacterService(db);
    const [character] = await characters.listForOwner(worldId, userId);
    assert.ok(character);

    await characters.update(character.id, {
      level: 5,
      abilities: {
        strength: 12,
        dexterity: 16,
        constitution: 14,
        intelligence: 10,
        wisdom: 10,
        charisma: 8,
      },
      combat: {
        armorClass: 17,
        initiativeBonus: 2,
      },
    });

    const loaded = await characters.getById(character.id);
    assert.ok(loaded);
    const snapshot = buildCharacterSheetSnapshot(loaded);
    assert.equal(snapshot.proficiencyBonus, 3);
    assert.equal(snapshot.modifiers.dexterity, 3);
    assert.equal(snapshot.armorClass, 17);
    assert.equal(snapshot.initiative, 5);
    assert.deepEqual(parseCharacterCombat({ armor_class: 15, initiative_bonus: 1 }), {
      armorClass: 15,
      initiativeBonus: 1,
      maxHp: undefined,
      currentHp: undefined,
      speed: undefined,
    });
    await db.$disconnect();
  });
});
