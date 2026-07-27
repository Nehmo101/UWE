import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createCharacterService } from "./character-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";

describe("character sheet permissions (portal)", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let worldId: string;
  let dmUserId: string;
  let playerOneId: string;
  let playerOneCharacterId: string;
  let playerTwoCharacterId: string;
  let dmOnlyCharacterId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Char Permission World",
      slug: "char-permission-world",
    });
    worldSlug = world.slug;
    worldId = world.id;

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm-char-perm@test.local",
      password: "test",
      role: "dm",
    });
    dmUserId = dm.id;

    const playerOne = await auth.createUser({
      displayName: "Player One",
      email: "player1-char-perm@test.local",
      password: "test",
      role: "player",
    });
    playerOneId = playerOne.id;

    const playerTwo = await auth.createUser({
      displayName: "Player Two",
      email: "player2-char-perm@test.local",
      password: "test",
      role: "player",
    });

    await auth.createWorldMembership({ userId: dm.id, worldId, role: "dm" });
    await auth.createWorldMembership({ userId: playerOne.id, worldId, role: "player" });
    await auth.createWorldMembership({ userId: playerTwo.id, worldId, role: "player" });

    const visiblePage = await repo.createPage({
      worldId,
      title: "Aria",
      slug: "aria-pc",
      type: "player_character",
      visibility: "player_visible",
    });

    const dmOnlyPage = await repo.createPage({
      worldId,
      title: "Geheimer NSC-Bogen",
      slug: "geheimer-nsc-bogen",
      type: "player_character",
      visibility: "dm_only",
    });

    const characters = createCharacterService(db);
    const playerOneCharacter = await characters.create({
      worldId,
      ownerUserId: playerOne.id,
      displayName: "Aria",
      pageId: visiblePage.id,
      level: 3,
    });
    playerOneCharacterId = playerOneCharacter.id;

    const playerTwoCharacter = await characters.create({
      worldId,
      ownerUserId: playerTwo.id,
      displayName: "Borin",
      level: 4,
    });
    playerTwoCharacterId = playerTwoCharacter.id;

    // Owned by player one but bound to a dm_only page → must stay hidden in the portal.
    const dmOnlyCharacter = await characters.create({
      worldId,
      ownerUserId: playerOne.id,
      displayName: "Verdeckter Bogen",
      pageId: dmOnlyPage.id,
      level: 9,
    });
    dmOnlyCharacterId = dmOnlyCharacter.id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("players only list their own characters; dm_only pages are filtered server-side", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerOneId });
    assert.ok(playerCtx);

    const listed = await auth.listCharactersForViewer(worldSlug, playerCtx);
    const listedIds = listed.map((entry) => entry.id);
    assert.ok(listedIds.includes(playerOneCharacterId));
    assert.ok(!listedIds.includes(playerTwoCharacterId), "foreign character must not be listed");
    assert.ok(!listedIds.includes(dmOnlyCharacterId), "dm_only-page character must be filtered");
    await db.$disconnect();
  });

  it("global owner with player world membership sees all characters as staff", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const globalOwner = await auth.createUser({
      displayName: "Global Owner",
      email: "global-owner-char-perm@test.local",
      password: "test",
      role: "owner",
    });

    await auth.createWorldMembership({
      userId: globalOwner.id,
      worldId,
      role: "player",
      characterName: "Owner PC",
    });

    const ownerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: globalOwner.id });
    assert.ok(ownerCtx);
    assert.equal(ownerCtx.effectiveRole, "owner");

    const listed = await auth.listCharactersForViewer(worldSlug, ownerCtx);
    const listedIds = listed.map((entry) => entry.id);
    assert.ok(listedIds.includes(playerOneCharacterId));
    assert.ok(listedIds.includes(playerTwoCharacterId));
    assert.ok(listedIds.includes(dmOnlyCharacterId));
    await db.$disconnect();
  });

  it("world staff sees all characters of the world", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(dmCtx);

    const listed = await auth.listCharactersForViewer(worldSlug, dmCtx);
    const listedIds = listed.map((entry) => entry.id);
    assert.ok(listedIds.includes(playerOneCharacterId));
    assert.ok(listedIds.includes(playerTwoCharacterId));
    assert.ok(listedIds.includes(dmOnlyCharacterId));
    await db.$disconnect();
  });

  it("players cannot read foreign or dm_only characters via getCharacterForViewer", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerOneId });
    assert.ok(playerCtx);

    const own = await auth.getCharacterForViewer(worldSlug, playerOneCharacterId, playerCtx);
    assert.equal(own?.id, playerOneCharacterId);
    assert.equal(own?.ownerUserId, playerOneId);

    const foreign = await auth.getCharacterForViewer(worldSlug, playerTwoCharacterId, playerCtx);
    assert.equal(foreign, null);

    const hidden = await auth.getCharacterForViewer(worldSlug, dmOnlyCharacterId, playerCtx);
    assert.equal(hidden, null);
    await db.$disconnect();
  });

  it("updateCharacterForOwner only allows the owning player", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerOneId });
    assert.ok(playerCtx);

    const updated = await auth.updateCharacterForOwner(
      worldSlug,
      playerOneCharacterId,
      { level: 4 },
      playerCtx,
    );
    assert.equal(updated?.level, 4);

    const foreign = await auth.updateCharacterForOwner(
      worldSlug,
      playerTwoCharacterId,
      { level: 20 },
      playerCtx,
    );
    assert.equal(foreign, null);

    const characters = createCharacterService(db);
    const unchanged = await characters.getById(playerTwoCharacterId);
    assert.equal(unchanged?.level, 4, "foreign character must stay unchanged");
    await db.$disconnect();
  });

  it("staff and preview contexts cannot write through the portal owner path", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const dmCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(dmCtx);
    const dmWrite = await auth.updateCharacterForOwner(
      worldSlug,
      playerOneCharacterId,
      { level: 19 },
      dmCtx,
    );
    assert.equal(dmWrite, null);

    const previewCtx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: dmUserId,
      preview: { previewAsUserId: playerOneId },
    });
    assert.ok(previewCtx);
    const previewWrite = await auth.updateCharacterForOwner(
      worldSlug,
      playerOneCharacterId,
      { level: 19 },
      previewCtx,
    );
    assert.equal(previewWrite, null);

    const characters = createCharacterService(db);
    const unchanged = await characters.getById(playerOneCharacterId);
    assert.equal(unchanged?.level, 4, "character level must stay unchanged");
    await db.$disconnect();
  });

  it("owner updates persist skill profile and spellcasting config", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const playerCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerOneId });
    assert.ok(playerCtx);

    const updated = await auth.updateCharacterForOwner(
      worldSlug,
      playerOneCharacterId,
      {
        skills: {
          proficiencies: ["perception", "stealth"],
          expertise: ["stealth"],
          savingThrows: ["dexterity"],
        },
        spellcasting: { ability: "wisdom" },
      },
      playerCtx,
    );
    assert.ok(updated);
    assert.equal(updated.sheet.derived.spellcastingAbility, "wisdom");
    // Level 4 → prof +2; stealth expertise: DEX-Mod 0 + 4 = +4
    const stealth = updated.sheet.derived.skills.find((skill) => skill.key === "stealth");
    assert.equal(stealth?.proficiency, "expertise");

    const dexSave = updated.sheet.derived.savingThrows.find(
      (save) => save.ability === "dexterity",
    );
    assert.equal(dexSave?.proficient, true);
    await db.$disconnect();
  });
});
