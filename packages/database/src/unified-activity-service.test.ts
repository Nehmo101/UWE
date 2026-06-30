import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createAuthService } from "./auth";
import { createAuditLogService } from "./audit-log-service";
import { createActivityLogService } from "./activity-log-service";
import { listUnifiedActivity } from "./unified-activity-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("unified activity service", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("merges activity and audit entries by timestamp", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const owner = await auth.createUser({
      email: "owner-cockpit@test.local",
      displayName: "Owner Cockpit",
      password: "test-pass-123",
      role: "owner",
    });

    const activity = createActivityLogService(db);
    await activity.log({
      action: "content_created",
      targetType: "page",
      summary: "Seite erstellt",
      worldSlug: "terra",
    });

    const audit = createAuditLogService(db);
    await audit.log({
      actorUserId: owner.id,
      action: "login_success",
      targetType: "session",
      metadata: { surface: "studio" },
    });

    const { entries } = await listUnifiedActivity(db, { limit: 10 });
    assert.ok(entries.length >= 2);
    assert.ok(entries.some((entry) => entry.source === "activity"));
    assert.ok(entries.some((entry) => entry.source === "audit"));
    assert.ok(entries[0]!.timestamp >= entries[1]!.timestamp);

    await db.$disconnect();
  });
});
