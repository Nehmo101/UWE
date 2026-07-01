import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { getAdminOnboardingChecklist } from "./admin-onboarding-checklist-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("admin onboarding checklist", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("returns checklist with progress metrics", async () => {
    const checklist = await getAdminOnboardingChecklist(db, { role: "owner" });

    assert.ok(checklist.totalCount >= 9);
    assert.ok(checklist.progressPercent >= 0 && checklist.progressPercent <= 100);
    assert.equal(checklist.completedCount + checklist.openCount + checklist.warningCount <= checklist.totalCount, true);
    assert.ok(checklist.items.some((item) => item.id === "migrations-current"));
    assert.ok(checklist.items.some((item) => item.id.startsWith("setup-")));
  });
});
