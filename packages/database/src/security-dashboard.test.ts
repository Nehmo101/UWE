import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  assertSecurityDashboardHasNoSecrets,
  buildSecurityWarnings,
  getSecurityDashboardStatus,
  getAreaAccessCounts,
} from "./security-dashboard";
import { getSystemStatus } from "./system-status";
import { assessStudioSecurity } from "./studio-security";
describe("security dashboard warnings", () => {
  it("warns when no backups exist", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db);
      const studioSecurity = assessStudioSecurity(system, { NODE_ENV: "development" });
      const warnings = buildSecurityWarnings({
        env: { NODE_ENV: "development" },
        system,
        studioSecurity,
        sessionSecret: {
          configured: true,
          strong: true,
          envKey: "AUTH_SECRET",
          message: "ok",
        },
        setupToken: {
          active: false,
          secure: true,
          message: "deaktiviert",
        },
        backupCount: 0,
        authActive: true,
      });

      assert.ok(warnings.some((warning) => warning.id === "security:no-backups"));
    } finally {
      await db.$disconnect();
    }
  });

  it("warns when setup token is active", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db);
      const studioSecurity = assessStudioSecurity(system, { NODE_ENV: "development" });
      const warnings = buildSecurityWarnings({
        env: { NODE_ENV: "development", UWE_SETUP_TOKEN: "short" },
        system,
        studioSecurity,
        sessionSecret: {
          configured: true,
          strong: true,
          envKey: "AUTH_SECRET",
          message: "ok",
        },
        setupToken: {
          active: true,
          secure: false,
          message: "UWE_SETUP_TOKEN aktiv aber unsicher",
        },
        backupCount: 1,
        authActive: true,
      });

      assert.ok(warnings.some((warning) => warning.id === "security:setup-token-active"));
    } finally {
      await db.$disconnect();
    }
  });
});

describe("security dashboard status", () => {
  it("counts how many accounts hold each checkbox", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      await db.user.createMany({
        data: [
          {
            displayName: "Owner",
            isOwner: true,
            portalAccess: true,
            studioAccess: true,
            brainAccess: true,
            familyAccess: true,
          },
          { displayName: "DM", portalAccess: true, studioAccess: true },
          { displayName: "Player", portalAccess: true },
          { displayName: "Family Member", familyAccess: true },
        ],
      });

      const counts = await getAreaAccessCounts(db);
      assert.equal(counts.owner, 1);
      assert.equal(counts.portal, 3);
      assert.equal(counts.studio, 2);
      assert.equal(counts.brain, 1);
      assert.equal(counts.family, 2);
    } finally {
      await db.$disconnect();
    }
  });

  it("does not leak secrets in serialized output", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const secret = "super-secret-session-value-12345";
    try {
      const status = await getSecurityDashboardStatus(db, {
        env: {
          NODE_ENV: "development",
          AUTH_SECRET: secret,
          UWE_SETUP_TOKEN: secret,
          ENGINE_AGENT_TOKEN: secret,
          SMTP_PASSWORD: secret,
          SPOTIFY_CLIENT_SECRET: secret,
        },
      });

      assertSecurityDashboardHasNoSecrets(status, {
        AUTH_SECRET: secret,
        UWE_SETUP_TOKEN: secret,
        ENGINE_AGENT_TOKEN: secret,
        SMTP_PASSWORD: secret,
        SPOTIFY_CLIENT_SECRET: secret,
      });
    } finally {
      await db.$disconnect();
    }
  });

  it("does not mark Studio protected when public exposure lacks an API token", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const status = await getSecurityDashboardStatus(db, {
        env: {
          NODE_ENV: "production",
          PUBLIC_APP_URL: "https://uwe.example",
          TRUST_PROXY: "true",
          CLOUDFLARE_TUNNEL: "true",
          AUTH_SECRET: "strong-auth-secret-for-security-dashboard-test",
          AUTH_REQUIRED: "true",
          RUN_DB_SEED: "false",
        },
      });

      assert.equal(status.studioSecurity.severity, "critical");
      assert.equal(status.publicRoutes.studioAdminProtected, false);
    } finally {
      await db.$disconnect();
    }
  });
});
