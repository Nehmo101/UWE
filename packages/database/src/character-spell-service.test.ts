import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";
import { createCharacterService } from "./character-service";
import {
  buildHomebrewSpellKey,
  computeSpellSlots,
  createCharacterSpellService,
  effectiveCasterLevel,
  parseCharacterClasses,
  parseHomebrewSpellInput,
} from "./character-spell-service";

describe("character spell service", () => {
  let databaseUrl: string;
  let worldId: string;
  let userId: string;
  let characterId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Spell Test", slug: "spell-test" });
    worldId = world.id;

    const user = await db.user.create({
      data: {
        displayName: "Caster",
        email: "caster@test.local",
        role: "player",
      },
    });
    userId = user.id;

    const characters = createCharacterService(db);
    const character = await characters.create({
      worldId,
      ownerUserId: userId,
      displayName: "Mira",
      level: 5,
      classes: [{ name: "Wizard", level: 5 }],
    });
    characterId = character.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("computes full caster slots for level 5", () => {
    const summary = computeSpellSlots(5, [{ name: "Wizard", level: 5 }]);
    assert.equal(summary.casterLevel, 5);
    assert.equal(summary.byLevel[1], 4);
    assert.equal(summary.byLevel[2], 3);
    assert.equal(summary.byLevel[3], 2);
  });

  it("uses character level when classes are missing", () => {
    const summary = computeSpellSlots(3, null);
    assert.equal(summary.casterLevel, 3);
    assert.equal(summary.byLevel[1], 4);
    assert.equal(summary.byLevel[2], 2);
  });

  it("combines multiclass levels with half-caster rounding", () => {
    const classes = [
      { name: "Wizard", level: 3 },
      { name: "Paladin", level: 4 },
    ];
    assert.equal(effectiveCasterLevel(7, classes), 5);
    const summary = computeSpellSlots(7, classes);
    assert.equal(summary.casterLevel, 5);
    assert.equal(summary.byLevel[3], 2);
  });

  it("parses character classes from JSON", () => {
    assert.deepEqual(parseCharacterClasses([{ name: "Wizard", level: 4 }]), [
      { name: "Wizard", level: 4 },
    ]);
    assert.deepEqual(parseCharacterClasses(null), []);
  });

  it("parses homebrew spell input", () => {
    const parsed = parseHomebrewSpellInput({
      name: "Flammenkreis",
      spellLevel: "2",
      prepared: "on",
    });
    assert.ok(parsed);
    assert.equal(parsed.spellKey, buildHomebrewSpellKey("Flammenkreis"));
    assert.equal(parsed.spellLevel, 2);
    assert.equal(parsed.prepared, true);
    assert.equal(parsed.source, "homebrew");
  });

  it("lists, upserts, and removes character spells", async () => {
    const db = createPrismaClient(databaseUrl);
    const characters = createCharacterService(db);
    const spells = createCharacterSpellService(db);

    await characters.upsertSpell({
      characterId,
      spellKey: "magic-missile",
      spellLevel: 1,
      prepared: true,
      source: "open5e",
    });
    await characters.upsertSpell({
      characterId,
      spellKey: buildHomebrewSpellKey("Eigenes Licht"),
      spellLevel: 0,
      prepared: false,
      source: "homebrew",
      notes: "Eigenes Licht",
    });

    const listed = await spells.listSpells(characterId);
    assert.equal(listed.length, 2);
    assert.ok(listed.some((spell) => spell.spellKey === "magic-missile" && spell.prepared));

    const removed = await spells.removeSpell(characterId, "magic-missile");
    assert.equal(removed, true);
    const afterRemove = await spells.listSpells(characterId);
    assert.equal(afterRemove.length, 1);
    await db.$disconnect();
  });
});
