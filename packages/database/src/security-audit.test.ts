import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { logSecurityEvent } from "./security-audit";
import { createTestDatabaseUrl } from "./test-helpers";

describe("security audit log", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("writes security events as activity log warnings", async () => {
    await logSecurityEvent(db, {
      event: "studio_access_denied",
      summary: "Studio-Zugriff verweigert (CSRF).",
      details: { path: "/api/backup", denial: "csrf" },
    });

    const entry = await db.activityLog.findFirst({
      where: { targetLabel: "studio_access_denied" },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(entry);
    assert.equal(entry?.action, "warning");
    assert.match(entry?.summary ?? "", /verweigert/);
    const details = entry?.details as { category?: string; event?: string };
    assert.equal(details.category, "security");
    assert.equal(details.event, "studio_access_denied");
  });
});
