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
      appliedMigrations: ["20240101000000_init"],
      pendingMigrations: [],
      failedMigrations: [],
      failedDetails: [],
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
      exposureHint: "",
    },
    proxy: {
      publicAppUrl: null,
      trustProxy: false,
      cloudflareTunnel: false,
      studioPath: "/studio",
      portalPath: "/portal",
      studioUrl: null,
      portalUrl: null,
      deploymentModel: "local",
      cloudflare: {
        tunnelConfigured: false,
        portalUrlConfigured: false,
        studioUrlConfigured: false,
        portalUrlMatchesPublicBase: false,
        studioOnSeparateHost: false,
        deploymentModel: "local",
        humanVerificationEnabled: false,
        humanVerificationConfigured: false,
      },
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
      engineExposure: {
        ok: true,
        severity: "ok",
        message: "OK",
        endpoints: [],
        nextSteps: [],
      },
      engine: {
        ready: false,
        online: false,
        message: "offline",
        urlAllowed: true,
        source: "inference",
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
    const engine = statuses.find((entry) => entry.id === "engine_connector");

    assert.equal(db?.ok, false);
    assert.equal(backup?.severity, "error");
    assert.equal(engine?.severity, "error");
  });

  it("blocks public Maschinenraum exposure in security checklist", () => {
    const checks = buildHomelabSecurityChecklist({
      system: baseSystem(),
      studioSecurity,
      engineExposure: {
        ok: false,
        severity: "critical",
        message: "Maschinenraum public",
        endpoints: [],
        nextSteps: [],
      },
      accessCounts: { owner: 1, portal: 1, studio: 1, brain: 1, family: 1 },
      totalUsers: 1,
      hardwareUrlWarnings: [
        {
          deviceId: "1",
          deviceName: "Maschinenraum",
          field: "publicUrl",
          url: "https://bad.example",
          message: "bad",
        },
      ],
    });

    const engineCheck = checks.find((entry) => entry.id === "no_public_engine");
    assert.equal(engineCheck?.ok, false);
    assert.equal(engineCheck?.severity, "error");
  });

  it("aggregates today alerts from hardware and services", () => {
    const alerts = aggregateHomelabTodayAlerts({
      hardwareIssues: 1,
      hardwareUrlWarnings: [
        {
          deviceId: "1",
          deviceName: "Maschinenraum",
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
      problem: "Maschinenraum-Agent timeout",
      resolution: "Ollama neu gestartet",
      affectedServices: ["engine_connector", "ollama"],
    });

    const history = parseHardwareErrorHistory(metadata);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.problem, "Maschinenraum-Agent timeout");
    assert.deepEqual(history[0]?.affectedServices, ["engine_connector", "ollama"]);
  });
});
