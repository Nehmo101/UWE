import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createPageVersionService } from "./page-version-service";
import { createTestDatabaseUrl } from "./test-helpers";

async function seedPage(db: PrismaClient, slug: string) {
  const world = await db.world.create({
    data: { name: `Version World ${slug}`, slug: `version-world-${slug}` },
  });
  return db.page.create({
    data: {
      worldId: world.id,
      title: "Versioned Page",
      slug: `versioned-page-${slug}`,
      type: "location",
    },
  });
}

describe("page-version-service", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("creates snapshots with incrementing version numbers", async () => {
    const page = await seedPage(db, "increment");
    const service = createPageVersionService(db);

    const first = await service.createSnapshot(page.id, { title: "v1" }, "user-1");
    const second = await service.createSnapshot(page.id, { title: "v2" });

    assert.equal(first.version, 1);
    assert.equal(first.createdBy, "user-1");
    assert.equal(second.version, 2);
    assert.equal(second.createdBy, null);
  });

  it("lists versions newest first", async () => {
    const page = await seedPage(db, "list");
    const service = createPageVersionService(db);

    await service.createSnapshot(page.id, { title: "v1" });
    await service.createSnapshot(page.id, { title: "v2" });
    await service.createSnapshot(page.id, { title: "v3" });

    const versions = await service.list(page.id);
    assert.equal(versions.length, 3);
    assert.deepEqual(
      versions.map((entry) => entry.version),
      [3, 2, 1],
    );
  });

  it("restores a specific version snapshot and returns null for unknown versions", async () => {
    const page = await seedPage(db, "restore");
    const service = createPageVersionService(db);

    await service.createSnapshot(page.id, { title: "v1", body: "alt" });
    await service.createSnapshot(page.id, { title: "v2", body: "neu" });

    const restored = await service.restore(page.id, 1);
    assert.ok(restored);
    assert.equal(restored?.version, 1);
    assert.deepEqual(restored?.snapshot, { title: "v1", body: "alt" });

    const missing = await service.restore(page.id, 99);
    assert.equal(missing, null);
  });
});
