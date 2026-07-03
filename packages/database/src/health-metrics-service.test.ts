import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  computeHealthLight,
  createHealthMetricsService,
  formatBytes,
} from "./health-metrics-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("formatBytes (pure)", () => {
  it("formats byte magnitudes with a German decimal comma", () => {
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1536), "1,5 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5 MB");
    assert.equal(formatBytes(null), "—");
  });
});

describe("computeHealthLight (pure)", () => {
  it("is red when migrations are not ok", () => {
    assert.equal(
      computeHealthLight({ migrationsOk: false, connectorOnline: true, dbSizeBytes: 0 }),
      "red",
    );
  });
  it("is red when the DB exceeds the critical size", () => {
    assert.equal(
      computeHealthLight({ migrationsOk: true, connectorOnline: true, dbSizeBytes: 3 * 1024 ** 3 }),
      "red",
    );
  });
  it("is yellow when the connector is offline", () => {
    assert.equal(
      computeHealthLight({ migrationsOk: true, connectorOnline: false, dbSizeBytes: 0 }),
      "yellow",
    );
  });
  it("is yellow when the DB passes the warn threshold", () => {
    assert.equal(
      computeHealthLight({ migrationsOk: true, connectorOnline: true, dbSizeBytes: 600 * 1024 ** 2 }),
      "yellow",
    );
  });
  it("is green in the healthy case", () => {
    assert.equal(
      computeHealthLight({ migrationsOk: true, connectorOnline: true, dbSizeBytes: 1024 }),
      "green",
    );
  });
});

describe("health metrics (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({ name: "H", slug: "health-test" });
    await db.page.create({ data: { worldId: world.id, title: "S", slug: "s", type: "lore" } });
    await db.asset.create({
      data: { worldId: world.id, title: "Bild", type: "image", storageKey: "k", size: 2048 },
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("reports counts, upload volume and a light", async () => {
    const metrics = await createHealthMetricsService(db).getMetrics();
    const pages = metrics.largestTables.find((t) => t.label === "Seiten");
    assert.ok(pages && pages.count >= 1);
    assert.equal(metrics.uploads.count, 1);
    assert.equal(metrics.uploads.totalBytes, 2048);
    assert.ok(["green", "yellow", "red"].includes(metrics.light));
    // Connector offline in the test DB → not green.
    assert.equal(metrics.connector.online, false);
  });
});
