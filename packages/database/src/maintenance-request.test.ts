import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { evaluateMaintenanceForRequest } from "./maintenance-request";
import { createSettingsService } from "./settings-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("evaluateMaintenanceForRequest", () => {
  it("allows owner bypass while studio is locked", async () => {
    const databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const settings = createSettingsService(db);

    const owner = await auth.createUser({
      displayName: "Owner",
      email: "maint-owner@example.com",
      password: "test-password-123",
      role: "owner",
    });
    const session = await auth.createSession(owner.id);

    await settings.updateSettings({
      maintenance: {
        maintenanceMode: false,
        lockPortal: false,
        lockStudio: true,
        message: "Studio gesperrt",
      },
    });

    const decision = await evaluateMaintenanceForRequest({
      surface: "studio",
      pathname: "/today",
      cookieHeader: `uwe_session=${encodeURIComponent(session.token)}`,
      db,
    });

    assert.equal(decision.blocked, false);

    await db.$disconnect();
  });

  it("blocks non-owner studio access when lockStudio is active", async () => {
    const databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);
    const settings = createSettingsService(db);

    const dm = await auth.createUser({
      displayName: "DM",
      email: "maint-dm@example.com",
      password: "test-password-123",
      role: "dm",
    });
    const session = await auth.createSession(dm.id);

    await settings.updateSettings({
      maintenance: {
        maintenanceMode: false,
        lockPortal: false,
        lockStudio: true,
        message: "Studio gesperrt",
      },
    });

    const decision = await evaluateMaintenanceForRequest({
      surface: "studio",
      pathname: "/today",
      cookieHeader: `uwe_session=${encodeURIComponent(session.token)}`,
      db,
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, "lock_studio");

    await db.$disconnect();
  });
});
