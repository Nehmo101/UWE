import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { getOwnerCockpitSnapshot } from "./owner-cockpit-service";
import { createTestDatabaseUrl } from "./test-helpers";

const MS_PER_DAY = 86_400_000;

describe("owner cockpit service", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("lists open bugs in errors and summarizes ai usage", async () => {
    const user = await db.user.create({
      data: {
        displayName: "Cockpit Tester",
        email: "cockpit@test.local",
        passwordHash: "test",
        role: "owner",
      },
    });

    const [openBug, inProgressBug, resolvedBug] = await Promise.all([
      db.bugReport.create({
        data: {
          title: "Login bricht ab",
          description: "",
          severity: "high",
          module: "studio",
          status: "open",
        },
      }),
      db.bugReport.create({
        data: {
          title: "Upload langsam",
          description: "",
          severity: "low",
          status: "in_progress",
        },
      }),
      db.bugReport.create({
        data: {
          title: "Alter Fehler",
          description: "",
          severity: "critical",
          status: "resolved",
        },
      }),
    ]);

    const now = new Date();
    await db.aiUsageLog.createMany({
      data: [
        {
          userId: user.id,
          feature: "dnd_generator",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0.05,
          success: true,
          createdAt: new Date(now.getTime() - 1000),
        },
        {
          userId: user.id,
          feature: "general_chat",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 200,
          outputTokens: 80,
          estimatedCostUsd: 0.02,
          success: true,
          createdAt: new Date(now.getTime() - 3 * MS_PER_DAY),
        },
        {
          userId: user.id,
          feature: "outside_window",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 500,
          outputTokens: 200,
          estimatedCostUsd: 9.99,
          success: true,
          createdAt: new Date(now.getTime() - 20 * MS_PER_DAY),
        },
        {
          userId: user.id,
          feature: "failed_call",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 10,
          outputTokens: 0,
          estimatedCostUsd: 5,
          success: false,
          createdAt: new Date(now.getTime() - 1000),
        },
      ],
    });

    const snapshot = await getOwnerCockpitSnapshot(db);

    const bugErrors = snapshot.errors.filter((entry) => entry.source === "bug");
    const bugErrorIds = bugErrors.map((entry) => entry.id);
    assert.ok(bugErrorIds.includes(`bug:${openBug.id}`));
    assert.ok(bugErrorIds.includes(`bug:${inProgressBug.id}`));
    assert.ok(!bugErrorIds.includes(`bug:${resolvedBug.id}`));

    const openBugEntry = bugErrors.find((entry) => entry.id === `bug:${openBug.id}`);
    assert.equal(openBugEntry?.href, "/bugs");
    assert.equal(openBugEntry?.detail, "Hoch · studio");

    assert.equal(snapshot.ok, false);

    assert.equal(snapshot.aiUsage.todayRequests, 1);
    assert.ok(Math.abs(snapshot.aiUsage.todayCostUsd - 0.05) < 1e-9);
    assert.equal(snapshot.aiUsage.last7DaysRequests, 2);
    assert.ok(Math.abs(snapshot.aiUsage.last7DaysCostUsd - 0.07) < 1e-9);
    assert.equal(snapshot.aiUsage.topFeature?.feature, "dnd_generator");
    assert.equal(snapshot.aiUsage.topFeature?.requestCount, 1);
  });
});
