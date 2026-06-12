import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { getMigrationStatus } from "./migration-status";
import { buildNextActions } from "./next-actions";
import { ensureSystemPageTemplates } from "./page-template-service";
import { createUweRepository, type UweRepository } from "./repository";
import { getSystemStatus } from "./system-status";
import { createTestDatabaseUrl } from "./test-helpers";

describe("system status and next actions", () => {
  let db: PrismaClient;
  let repo: UweRepository;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
  });

  it("reports applied migrations as current on a freshly migrated database", async () => {
    const status = await getMigrationStatus(db);
    assert.equal(status.ok, true);
    assert.ok(status.appliedCount > 0);
    assert.deepEqual(status.pendingMigrations, []);
    assert.deepEqual(status.failedMigrations, []);
  });

  it("builds a complete system status without leaking secrets", async () => {
    await ensureSystemPageTemplates(db);
    const status = await getSystemStatus(db);

    assert.equal(status.database.ok, true);
    assert.equal(status.migrations.ok, true);
    assert.match(status.version, /^\d+\.\d+\.\d+$/);
    assert.equal(status.seeds.pageTemplatesSeeded, true);
    assert.equal(status.trust.studioLogin, "none-by-design");
    assert.equal(typeof status.trust.studioApiTokenConfigured, "boolean");
    assert.ok(status.rateLimiter.mode.length > 0);

    // Hard rule: the status must never contain token/secret values.
    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes(process.env.STUDIO_API_TOKEN ?? "\u0000"));
    assert.ok(!/password|secret[^s]/i.test(serialized));
  });

  it("surfaces missing backups and open findings as next actions", async () => {
    const world = await repo.createWorld({ name: "Action World", slug: "action-world" });

    // A critical leak: player-visible GM note.
    await repo.createPage({
      worldId: world.id,
      title: "Leck",
      slug: "leck",
      type: "npc",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        { type: "gm_note", sortOrder: 0, visibility: "player_visible", content: "Geheim" },
      ],
    });

    const actions = await buildNextActions(db);

    const backupAction = actions.find((action) => action.id === "backup:none");
    assert.ok(backupAction, "missing backup must surface as next action");

    const inspectorAction = actions.find((action) => action.id === "inspector:action-world");
    assert.ok(inspectorAction, "open findings must surface as next action");
    assert.equal(inspectorAction.severity, "critical");
    assert.equal(inspectorAction.href, "/worlds/action-world/inspector");

    const portalAction = actions.find((action) => action.id === "portal-visible:action-world");
    assert.ok(portalAction, "publicly visible player content must surface");

    // Critical entries sort first.
    assert.equal(actions[0].severity, "critical");
  });
});
