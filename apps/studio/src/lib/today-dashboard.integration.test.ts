import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createLifeAdminService,
  createPrismaClient,
  createUweRepository,
  PERF_SMOKE_SCALE,
  seedStressWorld,
  type PrismaClient,
} from "@uwe/database/server";
// Der Dashboard-Aggregator liest über den brainPrisma-Singleton (vom
// Test-Runner auf eine migrierte Brain-Test-DB gezeigt) — deshalb muss auch
// das Seeding durch denselben Singleton laufen, nicht durch einen eigenen
// createTestBrainClient (der eine zweite, leere Brain-DB anlegen würde).
import { brainPrisma } from "@uwe/database/brain-client";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { getTodayDashboardData } from "./today-dashboard";

describe("today dashboard integration", () => {
  let db: PrismaClient;
  const brainDb = brainPrisma;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    (globalThis as { uweRepository?: ReturnType<typeof createUweRepository> }).uweRepository =
      repo;

    await seedStressWorld(repo, db, brainDb, {
      ...PERF_SMOKE_SCALE,
      pages: 15,
      links: 20,
      assets: 5,
      captures: 10,
      sessions: 2,
      handouts: 3,
      workshopProjects: 2,
      personalBrainDocs: 4,
      tagVariants: 5,
    });
  });

  it("aggregates life-admin summary into dashboard data", async () => {
    const data = await getTodayDashboardData(db, { useMockInference: true });
    assert.ok(data.lifeAdmin.inboxCaptureCount >= 1);
    assert.ok(typeof data.systemOk === "boolean");
    assert.ok(data.systemLabel.length > 0);
    assert.ok(Array.isArray(data.lifeAdmin.recentCaptures));
    assert.ok(Array.isArray(data.calendarToday));
    assert.ok(Array.isArray(data.calendarThisWeek));
  });

  it("scales today summary with seeded captures", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const summary = await lifeAdmin.getTodaySummary();
    assert.ok(summary.inboxCaptureCount >= 5);
    assert.ok(summary.activeWorkshopCount >= 1);
  });
});
