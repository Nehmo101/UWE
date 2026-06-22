import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createAuditLogService } from "./audit-log-service";
import { createPrismaClient } from "./client";
import {
  logLoginAttempt,
  LOGIN_AUDIT_REASON_LABELS,
  resolveLoginFailureReason,
} from "./login-audit";
import { createTestDatabaseUrl } from "./test-helpers";

describe("login audit", () => {
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
  });

  it("stores login failures with reason and never persists passwords", async () => {
    const db = createPrismaClient(databaseUrl);
    const audit = createAuditLogService(db);

    await logLoginAttempt({
      db,
      surface: "studio",
      request: { ip: "203.0.113.44", userAgent: "Mozilla/5.0" },
      email: "owner@example.com",
      reason: "invalid_credentials",
      httpStatus: 401,
      errorMessage: "Ungültige Anmeldedaten.",
      extraMetadata: {
        password: "must-not-persist",
      },
    });

    const entries = await audit.list({ actions: ["login_failed"], limit: 5 });
    assert.equal(entries.length, 1);

    const metadata = entries[0]!.metadataJson as Record<string, unknown>;
    assert.equal(metadata.surface, "studio");
    assert.equal(metadata.reason, "invalid_credentials");
    assert.equal(metadata.email, "owner@example.com");
    assert.equal(metadata.errorMessage, "Ungültige Anmeldedaten.");
    assert.equal(metadata.password, "[REDACTED]");

    await db.$disconnect();
  });

  it("logs server errors with sanitized messages", async () => {
    const db = createPrismaClient(databaseUrl);
    const audit = createAuditLogService(db);

    await logLoginAttempt({
      db,
      surface: "studio",
      request: { ip: "203.0.113.45" },
      email: "owner@example.com",
      reason: "server_error",
      httpStatus: 500,
      errorMessage: "Anmeldung vorübergehend nicht möglich.",
      serverError: new Error("SQLITE_ERROR: no such column: sessions.last_active_at"),
    });

    const entries = await audit.list({ actions: ["login_failed"], limit: 5 });
    const metadata = entries[0]!.metadataJson as Record<string, unknown>;
    assert.equal(metadata.reason, "server_error");
    assert.match(String(metadata.serverError), /last_active_at/);
    assert.equal(String(metadata.serverError).includes("password"), false);

    await db.$disconnect();
  });

  it("resolves studio access denial separately from invalid credentials", () => {
    assert.equal(
      resolveLoginFailureReason({
        surface: "studio",
        email: "player@example.com",
        userFound: true,
        userActive: true,
        passwordValid: true,
        studioAccessGranted: false,
      }),
      "studio_access_denied",
    );

    assert.equal(
      resolveLoginFailureReason({
        surface: "portal",
        email: "player@example.com",
        userFound: false,
        userActive: false,
        passwordValid: false,
      }),
      "invalid_credentials",
    );
  });

  it("exposes human-readable reason labels", () => {
    assert.equal(LOGIN_AUDIT_REASON_LABELS.server_error, "Serverfehler beim Login");
    assert.equal(LOGIN_AUDIT_REASON_LABELS.studio_access_denied, "Kein Studio-Zugriff für diese Rolle");
  });
});
