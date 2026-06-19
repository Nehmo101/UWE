import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateHomelabTodayAlerts,
  appendHardwareErrorEntry,
  buildHomelabSecurityChecklist,
  buildHomelabServiceStatuses,
  parseHardwareErrorHistory,
} from "./homelab-cockpit";
import type { SystemStatus } from "./system-status";

function baseSystem(overrides: Partial<SystemStatus> = {}): SystemStatus {
  return {
    ok: true,
    version: "test",
    commit: null,
    app: { ok: true, nodeEnv: "test", production: false },
    database: { ok: true, message: "OK" },
    migrations: {
      ok: true,
      appliedCount: 1,
      pendingMigrations: [],
      failedMigrations: [],
      message: "OK",
    },
    storage: {
      ok: true,
      uploadsWritable: true,
      backupsWritable: true,
      exportsWritable: true,
      databaseFileExists: true,
      paths: {} as SystemStatus["storage"]["paths"],
      message: "OK",
    },
    seeds: { pageTemplatesSeeded: true, expectedVersion: 1 },
    trust: {
      studioLogin: "session-login",
      studioApiTokenConfigured: true,
      authSecretConfigured: true,
      authSecretLooksWeak: false,
      runDbSeedDisabled: true,
      publicPortalSharingEnabled: false,
      exposureHint: "",
    },
    proxy: {
      publicAppUrl: null,
      trustProxy: false,
      cloudflareTunnel: false,
      authRequired: true,
      sessionCookieSecure: false,
      playerPreviewPublic: false,
      playerPreviewRequireToken: true,
      playerPreviewAllowDmOnly: false,
      publicExposureConfigured: false,
    },
    mail: { enabled: false, configured: false, useMock: true, message: "" },
    rateLimiter: { mode: "memory" },
    ...overrides,
  };
}

const studioSecurity = {
  level: "local_only" as const,
  label: "Lokal",
  severity: "ok" as const,
  message: "OK",
  publicExposureConfigured: false,
  proxyIndicators: {
    trustProxy: false,
    cloudflareTunnel: false,
    networkProtectionLikely: false,
  },
  checks: {
    studioApiTokenConfigured: true,
    authSecretConfigured: true,
    authSecretLooksWeak: false,
    runDbSeedDisabled: true,
    sessionCookieSecure: false,
    portalAuthRequired: true,
  },
  misconfigurations: [],
  nextSteps: [],
};

describe("homelab cockpit", () => {
  it("builds service statuses with live DB and backup signals", () => {
    const statuses = buildHomelabServiceStatuses({
      system: baseSystem({
        database: { ok: false, message: "DB down" },
        storage: {
          ...baseSystem().storage,
          backupsWritable: false,
        },
      }),
      studioSecurity,
      rtxExposure: {
        ok: true,
        severity: "ok",
        message: "OK",
        endpoints: [],
        nextSteps: [],
      },
      rtx: {
        ready: false,
        online: false,
        message: "offline",
        urlAllowed: true,
        source: "agent",
      },
      inference: {
        enabled: true,
        online: false,
        message: "offline",
        provider: "ollama",
      },
      backup: {
        writable: false,
        count: 0,
        lastAt: null,
        message: "Keine Backups",
      },
      portalProbe: { ok: true, message: "Portal OK" },
      timestamp: new Date().toISOString(),
    });

    const db = statuses.find((entry) => entry.id === "database");
    const backup = statuses.find((entry) => entry.id === "backup");
    const rtx = statuses.find((entry) => entry.id === "rtx_agent");

    assert.equal(db?.ok, false);
    assert.equal(backup?.severity, "error");
    assert.equal(rtx?.severity, "error");
  });

  it("blocks public RTX exposure in security checklist", () => {
    const checks = buildHomelabSecurityChecklist({
      system: baseSystem(),
      studioSecurity,
      rtxExposure: {
        ok: false,
        severity: "critical",
        message: "RTX public",
        endpoints: [],
        nextSteps: [],
      },
      roleCounts: { owner: 1, admin: 0, dm: 0, player: 0 },
      hardwareUrlWarnings: [
        {
          deviceId: "1",
          deviceName: "RTX",
          field: "publicUrl",
          url: "https://bad.example",
          message: "bad",
        },
      ],
    });

    const rtxCheck = checks.find((entry) => entry.id === "no_public_rtx");
    assert.equal(rtxCheck?.ok, false);
    assert.equal(rtxCheck?.severity, "error");
  });

  it("aggregates today alerts from hardware and services", () => {
    const alerts = aggregateHomelabTodayAlerts({
      hardwareIssues: 1,
      hardwareUrlWarnings: [
        {
          deviceId: "1",
          deviceName: "RTX",
          field: "publicUrl",
          url: "https://bad.example",
          message: "bad",
        },
      ],
      openSetupSteps: 2,
      serviceStatuses: [
        {
          id: "database",
          label: "DB",
          ok: false,
          severity: "error",
          message: "down",
        },
      ],
      securityChecks: [],
    });

    assert.ok(alerts.criticalCount >= 2);
    assert.ok(alerts.messages.some((message) => message.includes("URL-Warnung")));
  });

  it("stores and parses hardware error history in metadata", () => {
    const metadata = appendHardwareErrorEntry(null, {
      problem: "RTX Agent timeout",
      resolution: "Ollama neu gestartet",
      affectedServices: ["rtx_agent", "ollama"],
    });

    const history = parseHardwareErrorHistory(metadata);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.problem, "RTX Agent timeout");
    assert.deepEqual(history[0]?.affectedServices, ["rtx_agent", "ollama"]);
  });
});
