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
    assert.equal(status.app.ok, true);
    assert.equal(typeof status.app.nodeEnv, "string");
    assert.equal(typeof status.app.production, "boolean");
    assert.equal(status.seeds.pageTemplatesSeeded, true);
    assert.equal(status.trust.studioLogin, "none-by-design");
    assert.equal(typeof status.trust.studioApiTokenConfigured, "boolean");
    assert.equal(typeof status.trust.authSecretConfigured, "boolean");
    assert.equal(typeof status.trust.authSecretLooksWeak, "boolean");
    assert.equal(typeof status.trust.runDbSeedDisabled, "boolean");
    assert.equal(typeof status.trust.publicPortalSharingEnabled, "boolean");
    assert.equal(typeof status.storage.exportsWritable, "boolean");
    assert.ok(
      status.storage.databaseFileExists === null ||
        typeof status.storage.databaseFileExists === "boolean",
    );
    assert.ok(status.storage.paths.uploadsDir.length > 0);
    assert.ok(status.storage.paths.backupsDir.length > 0);
    assert.ok(status.storage.paths.exportsDir.length > 0);
    assert.ok(status.rateLimiter.mode.length > 0);

    // Hard rule: the status must never contain token/secret values.
    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes(process.env.STUDIO_API_TOKEN ?? "\u0000"));
    assert.ok(!serialized.includes(process.env.AUTH_SECRET ?? "\u0000"));
  });

  it("surfaces missing backups and open findings as next actions", async () => {
    const world = await repo.createWorld({ name: "Action World", slug: "action-world" });

    // A canon warning: page with a broken wikilink.
    await repo.createPage({
      worldId: world.id,
      title: "Kaputt",
      slug: "kaputt",
      type: "npc",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, content: "Verweist auf [[Nirgendwo]]." },
      ],
    });

    const actions = await buildNextActions(db);

    const backupAction = actions.find((action) => action.id === "backup:none");
    assert.ok(backupAction, "missing backup must surface as next action");

    const inspectorAction = actions.find((action) => action.id === "inspector:action-world");
    assert.ok(inspectorAction, "open findings must surface as next action");
    assert.equal(inspectorAction.href, "/worlds/action-world/inspector");
  });
});
