import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  evaluatePortalAccessForUser,
  portalAccessBadgeFromUser,
  type PortalAccessEvaluation,
} from "./portal-access-service";
import { createUweRepository } from "./repository";
import { SettingsService } from "./settings-service";
import { createTestDatabaseUrl } from "./test-helpers";

const TEST_PASSWORD = "portal-access-test";

describe("portal access predicate", () => {
  let databaseUrl: string;
  let worldId: string;
  let playerUserId: string;
  let disabledUserId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Portal Access World", slug: "portal-access-world" });
    worldId = world.id;
    const player = await auth.createUser({
      displayName: "Portal Player",
      email: "portal-player@uwe.local",
      password: TEST_PASSWORD,
      portalAccess: true,
      studioAccess: false,
      status: "active",
    });
    playerUserId = player.id;
    await auth.upsertWorldMembership({ userId: playerUserId, worldId: world.id });
    const disabled = await auth.createUser({
      displayName: "Disabled Player",
      email: "portal-disabled@uwe.local",
      password: TEST_PASSWORD,
      portalAccess: true,
      studioAccess: false,
      status: "disabled",
    });
    disabledUserId = disabled.id;
    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("grants access for active player with membership", async () => {
    const db = createPrismaClient(databaseUrl);
    const evaluation = await evaluatePortalAccessForUser(db, playerUserId);
    await db.$disconnect();
    assert.ok(evaluation?.allowed);
    assert.equal(evaluation?.summary, "granted");
  });

  it("denies disabled users with blockers", async () => {
    const db = createPrismaClient(databaseUrl);
    const evaluation = await evaluatePortalAccessForUser(db, disabledUserId);
    await db.$disconnect();
    assert.ok(evaluation && !evaluation.allowed);
    assert.ok(evaluation.blockers.some((b: string) => b.includes("Kontostatus")));
  });

  it("returns null for unknown users", async () => {
    const db = createPrismaClient(databaseUrl);
    const evaluation = await evaluatePortalAccessForUser(db, "missing");
    await db.$disconnect();
    assert.equal(evaluation, null);
  });

  it("reflects disabled portal setting", async () => {
    const db = createPrismaClient(databaseUrl);
    const settingsService = new SettingsService(db);
    const current = await settingsService.getSettings();
    await settingsService.updateSettings({ portal: { ...current.portal, portalEnabled: false } });
    const evaluation: PortalAccessEvaluation | null = await evaluatePortalAccessForUser(db, playerUserId);
    await settingsService.updateSettings({ portal: { ...current.portal, portalEnabled: true } });
    await db.$disconnect();
    assert.ok(evaluation && !evaluation.allowed);
  });

  it("derives badges", () => {
    const badge = portalAccessBadgeFromUser(
      {
        status: "active",
        access: { portal: true, studio: false, brain: false, family: false },
        email: "a@b.c",
        hasPassword: true,
        worldMemberships: [{ worldId }],
      },
      { portalEnabled: true },
    );
    assert.equal(badge.label, "Portal bereit");
  });
});
