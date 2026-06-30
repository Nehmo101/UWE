import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createAuthService } from "./auth";
import { createTestDatabaseUrl } from "./test-helpers";
import { createWorldCreationService } from "./world-creation-service";

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

    const membership = await db.worldMembership.findUnique({
      where: { userId_worldId: { userId: owner.id, worldId: world.id } },
    });
    assert.equal(membership?.role, "owner");

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
