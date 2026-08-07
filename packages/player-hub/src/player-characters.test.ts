import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService, createPrismaClient, createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "../../database/src/test-helpers";
import { createPlayerCharacterService } from "./player-characters";

describe("player character lifecycle", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let worldId: string;
  let playerId: string;
  let otherPlayerId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);
    const world = await repo.createWorld({ name: "Creator World", slug: "creator-world" });
    worldSlug = world.slug;
    worldId = world.id;
    const player = await auth.createUser({
      displayName: "Creator Player",
      email: "creator-player@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    playerId = player.id;
    await auth.createWorldMembership({ userId: player.id, worldId: world.id });
    const otherPlayer = await auth.createUser({
      displayName: "Other Player",
      email: "other-player@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    otherPlayerId = otherPlayer.id;
    await auth.createWorldMembership({ userId: otherPlayer.id, worldId: world.id });
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("duplicates the complete owned sheet and deletes copy plus page", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerId });
    assert.ok(ctx);
    const service = createPlayerCharacterService(db);
    const source = await service.createOwnCharacter(worldSlug, ctx, { displayName: "Kopierquelle" });
    assert.equal(source.ok, true);
    if (!source.ok) return;

    await db.character.update({
      where: { id: source.characterId },
      data: {
        level: 3,
        classes: [{ name: "Zauberer", level: 3 }],
        species: { schemaVersion: 1, key: "elf", name: "Elf" },
        background: { schemaVersion: 1, key: "sage", name: "Weiser" },
        bio: { schemaVersion: 1, alignment: null, backstory: "Archivarin" },
      },
    });
    await db.characterSpell.create({
      data: {
        characterId: source.characterId,
        spellKey: "magisches-geschoss",
        spellLevel: 1,
        prepared: true,
        displayName: "Magisches Geschoss",
      },
    });
    await db.inventoryItem.create({
      data: { worldId, characterId: source.characterId, name: "Zauberbuch", quantity: 1 },
    });

    const copy = await service.duplicateOwnCharacter(worldSlug, ctx, source.characterId);
    assert.equal(copy.ok, true);
    if (!copy.ok) return;
    const copied = await db.character.findUnique({
      where: { id: copy.characterId },
      include: { page: true, spells: true, inventoryItems: true },
    });
    assert.equal(copied?.displayName, "Kopierquelle (Kopie)");
    assert.equal(copied?.ownerUserId, playerId);
    assert.equal(copied?.campaignId, null);
    assert.equal(copied?.level, 3);
    assert.deepEqual(copied?.species, { schemaVersion: 1, key: "elf", name: "Elf" });
    assert.equal(copied?.spells.length, 1);
    assert.equal(copied?.inventoryItems.length, 1);
    assert.equal(copied?.inventoryItems[0]?.pageId, null);

    const otherCtx = await auth.buildAccessContextForWorld(worldSlug, { userId: otherPlayerId });
    assert.ok(otherCtx);
    assert.equal((await service.duplicateOwnCharacter(worldSlug, otherCtx, source.characterId)).ok, false);
    assert.equal((await service.deleteOwnCharacter(worldSlug, otherCtx, source.characterId)).ok, false);

    const pageId = copied?.pageId;
    assert.deepEqual(await service.deleteOwnCharacter(worldSlug, ctx, copy.characterId), { ok: true });
    assert.equal(await db.character.findUnique({ where: { id: copy.characterId } }), null);
    assert.equal(pageId ? await db.page.findUnique({ where: { id: pageId } }) : null, null);
    assert.equal(await db.inventoryItem.count({ where: { characterId: copy.characterId } }), 0);
    await db.$disconnect();
  });

  it("lets Studio create a character for a player and reassign owner plus campaign", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createPlayerCharacterService(db);
    const campaign = await db.campaign.create({
      data: { worldId, name: "Spielrunde", slug: "spielrunde" },
    });

    const created = await service.createAssignedCharacter({
      worldId,
      ownerUserId: playerId,
      campaignId: campaign.id,
      displayName: "Mara Sturm",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const character = await db.character.findUniqueOrThrow({
      where: { id: created.characterId },
      include: { page: true },
    });
    assert.equal(character.ownerUserId, playerId);
    assert.equal(character.campaignId, campaign.id);
    assert.equal(character.page?.campaignId, campaign.id);
    assert.equal(character.page?.portalReleased, true);

    assert.deepEqual(
      await service.updateAssignment({
        worldId,
        characterId: character.id,
        ownerUserId: otherPlayerId,
        campaignId: null,
      }),
      { ok: true },
    );
    const reassigned = await db.character.findUniqueOrThrow({
      where: { id: character.id },
      include: { page: true },
    });
    assert.equal(reassigned.ownerUserId, otherPlayerId);
    assert.equal(reassigned.campaignId, null);
    assert.equal(reassigned.page?.campaignId, null);
    await db.$disconnect();
  });
});
