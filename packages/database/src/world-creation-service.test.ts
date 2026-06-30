import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createAuthService } from "./auth";
import { createTestDatabaseUrl } from "./test-helpers";
import { createWorldCreationService } from "./world-creation-service";
import { getWorldTemplate, listWorldTemplateOptions } from "./world-templates";

describe("world templates", () => {
  it("lists DnD, Wiki and Roman archetypes", () => {
    const options = listWorldTemplateOptions();
    assert.deepEqual(
      options.map((entry) => entry.id),
      ["blank", "dnd", "wiki", "roman"],
    );
    assert.ok(getWorldTemplate("dnd")?.seedPages.length);
    assert.ok(getWorldTemplate("wiki")?.seedPages.length);
    assert.ok(getWorldTemplate("roman")?.seedPages.length);
  });
});

describe("world creation service", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("creates a world and owner membership", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const owner = await auth.createUser({
      displayName: "World Owner",
      email: "world-owner@uwe.local",
      password: "test-password-123456",
      role: "owner",
    });

    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(owner.id, {
      name: "Neue Kampagne",
      description: "Testwelt",
      guestModeEnabled: true,
    });

    assert.equal(world.name, "Neue Kampagne");
    assert.equal(world.slug, "neue-kampagne");
    assert.equal(world.guestModeEnabled, true);
    assert.equal(world.isSandbox, false);
    assert.equal(world.templateId, "blank");
    assert.equal(world.seededPageCount, 0);

    const membership = await db.worldMembership.findUnique({
      where: { userId_worldId: { userId: owner.id, worldId: world.id } },
    });
    assert.equal(membership?.role, "owner");

    await db.$disconnect();
  });

  it("seeds DnD template pages and a default campaign", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const owner = await auth.createUser({
      displayName: "DnD Owner",
      email: "dnd-owner@uwe.local",
      password: "test-password-123456",
      role: "owner",
    });

    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(owner.id, {
      name: "Meine DnD Welt",
      templateId: "dnd",
    });

    assert.equal(world.templateId, "dnd");
    assert.equal(world.seededPageCount, 5);

    const campaigns = await db.campaign.findMany({ where: { worldId: world.id } });
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0]?.slug, "hauptkampagne");

    const pages = await db.page.findMany({ where: { worldId: world.id }, orderBy: { title: "asc" } });
    assert.equal(pages.length, 5);
    assert.ok(pages.some((page) => page.type === "npc"));
    assert.ok(pages.some((page) => page.type === "session"));

    await db.$disconnect();
  });

  it("marks sandbox worlds and disables guest mode", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const owner = await auth.createUser({
      displayName: "Sandbox Owner",
      email: "sandbox-owner@uwe.local",
      password: "test-password-123456",
      role: "owner",
    });

    const service = createWorldCreationService(db);
    const world = await service.createWorldForUser(owner.id, {
      name: "Sandbox Test",
      templateId: "wiki",
      guestModeEnabled: true,
      isSandbox: true,
    });

    assert.equal(world.isSandbox, true);
    assert.equal(world.guestModeEnabled, false);
    assert.equal(world.seededPageCount, 3);

    const accessible = await auth.listAccessibleWorldsForUser(owner.id);
    assert.equal(
      accessible.some((entry) => entry.slug === world.slug),
      false,
    );

    await db.$disconnect();
  });

  it("requires a non-empty name", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      displayName: "Owner 2",
      email: "world-owner-2@uwe.local",
      password: "test-password-123456",
      role: "owner",
    });

    const service = createWorldCreationService(db);
    await assert.rejects(
      () => service.createWorldForUser(owner.id, { name: "   " }),
      /WORLD_NAME_REQUIRED/,
    );

    await db.$disconnect();
  });
});
