import assert from "node:assert/strict";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import {
  DEFAULT_SYSTEM_SETTINGS,
  createSettingsService,
  getPersistentPathConfiguration,
  getSystemSettingsSnapshotSafe,
  isGuestPortalAccessAllowed,
  resolveEffectiveExportsPath,
  resolveLocalOnlyMode,
  resolveSessionInactivityTimeoutMs,
} from "./settings-service";
import { buildMailSmtpCredentialsUpdate } from "./mail-smtp-settings";
import { createTestDatabaseUrl } from "./test-helpers";

describe("SettingsService", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("returns defaults when no row exists", async () => {
    const service = createSettingsService(createPrismaClient(databaseUrl));
    const settings = await service.getSettings();

    assert.equal(settings.app.theme, DEFAULT_SYSTEM_SETTINGS.app.theme);
    assert.equal(settings.app.backgroundPattern, "none");
    assert.equal(settings.app.themePreferences?.studio?.themeId, "uwe-ghibli-tag");
    assert.equal(settings.app.themePreferences?.brain?.themeId, "uwe-ghibli-nacht");
    assert.equal(settings.app.frostedGlass, false);
    assert.equal(settings.app.motionEnabled, true);
    assert.equal(settings.portal.portalEnabled, true);
    assert.equal(settings.ai.localOnlyMode, false);
  });

  it("persists and reloads settings", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);

    await service.updateSettings({
      app: { theme: "light" },
      worlds: { defaultCanonicalStatus: "canon" },
      portal: { guestAccessEnabled: false, publicSharingEnabled: false },
      ai: { localOnlyMode: true },
      storage: { uploadsPath: "./custom-uploads", exportsPath: "./custom-exports" },
      backup: { backupsPath: "./custom-backups" },
    });

    const reloaded = await service.getSettings();
    assert.equal(reloaded.app.theme, "light");
    assert.equal(reloaded.worlds.defaultCanonicalStatus, "canon");
    assert.equal(reloaded.portal.guestAccessEnabled, false);
    assert.equal(reloaded.ai.localOnlyMode, true);
    assert.equal(reloaded.storage.uploadsPath, "./custom-uploads");
    assert.equal(reloaded.storage.exportsPath, "./custom-exports");
    assert.equal(reloaded.backup.backupsPath, "./custom-backups");
  });

  it("resolves effective persistent paths from settings and env", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);
    const base = path.resolve("/tmp/uwe-path-test");

    const previousUploads = process.env.UPLOADS_DIR;
    delete process.env.UPLOADS_DIR;

    try {
      await service.updateSettings({
        storage: { uploadsPath: "./from-settings/uploads", exportsPath: "./from-settings/exports" },
        backup: { backupsPath: "./from-settings/backups" },
      });

      const settings = await service.getSettings();
      assert.equal(
        resolveEffectiveExportsPath(settings, base),
        path.resolve(base, "./from-settings/exports"),
      );

      const config = getPersistentPathConfiguration(settings, base);
      assert.equal(config.uploads.source, "settings");
      assert.equal(config.exports.source, "settings");
      assert.equal(config.backups.source, "settings");
      assert.ok(config.dataDir.length > 0);
    } finally {
      if (previousUploads === undefined) {
        delete process.env.UPLOADS_DIR;
      } else {
        process.env.UPLOADS_DIR = previousUploads;
      }
    }
  });


  it("keeps portal guest access disabled regardless of settings", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);
    const auth = createAuthService(db);

    await db.world.create({
      data: {
        name: "Guest World",
        slug: "guest-world",
        guestModeEnabled: true,
      },
    });

    await service.updateSettings({
      portal: { guestAccessEnabled: true },
    });

    const settings = await service.getSettings();
    const ctx = await auth.buildAccessContextForWorld("guest-world");
    assert.ok(ctx);
    assert.equal(isGuestPortalAccessAllowed(settings, true), false);
    assert.equal(ctx.guestModeEnabled, false);
  });

  it("exposes local-only mode from settings", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);

    const previousLocalOnly = process.env.AI_LOCAL_ONLY;
    const previousDatenschutz = process.env.AI_DATENSCHUTZ_MODE;
    delete process.env.AI_LOCAL_ONLY;
    delete process.env.AI_DATENSCHUTZ_MODE;

    try {
      await service.updateSettings({
        ai: { localOnlyMode: false },
      });

      const defaultMode = resolveLocalOnlyMode(await service.getSettings());
      assert.equal(defaultMode, false);

      await service.updateSettings({
        ai: { localOnlyMode: true },
      });

      const enabled = resolveLocalOnlyMode(await service.getSettings());
      assert.equal(enabled, true);
    } finally {
      if (previousLocalOnly === undefined) {
        delete process.env.AI_LOCAL_ONLY;
      } else {
        process.env.AI_LOCAL_ONLY = previousLocalOnly;
      }
      if (previousDatenschutz === undefined) {
        delete process.env.AI_DATENSCHUTZ_MODE;
      } else {
        process.env.AI_DATENSCHUTZ_MODE = previousDatenschutz;
      }
    }
  });

  it("preserves unchanged values on partial update", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);

    await service.updateSettings({
      app: { theme: "light" },
      worlds: { defaultCanonicalStatus: "canon" },
      portal: { guestAccessEnabled: false, publicSharingEnabled: false },
      ai: { localOnlyMode: true, enabled: false },
    });

    await service.updateSettings({
      app: { theme: "dark" },
    });

    const settings = await service.getSettings();
    assert.equal(settings.app.theme, "dark");
    assert.equal(settings.worlds.defaultCanonicalStatus, "canon");
    assert.equal(settings.portal.guestAccessEnabled, false);
    assert.equal(settings.portal.publicSharingEnabled, false);
    assert.equal(settings.ai.localOnlyMode, true);
    assert.equal(settings.ai.enabled, false);
  });

  it("never exposes API keys in client settings", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "super-secret-key";

    try {
      const service = createSettingsService(createPrismaClient(databaseUrl));
      const clientSettings = await service.getSettingsForClient();
      const openAi = clientSettings.ai.providerKeyPlaceholders.find((p) => p.id === "openai");

      assert.ok(openAi);
      assert.equal(openAi.configured, true);
      assert.equal(openAi.source, "env");
      assert.ok(!JSON.stringify(clientSettings).includes("super-secret-key"));
    } finally {
      if (original === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = original;
      }
    }
  });

  it("never exposes SMTP password in client settings", async () => {
    const originalPassword = process.env.SMTP_PASSWORD;
    const originalUser = process.env.SMTP_USER;
    const originalHost = process.env.SMTP_HOST;
    process.env.SMTP_PASSWORD = "smtp-secret-do-not-leak";
    process.env.SMTP_USER = "mailer@example.org";
    process.env.SMTP_HOST = "smtp.example.com";

    try {
      const service = createSettingsService(createPrismaClient(databaseUrl));
      const clientSettings = await service.getSettingsForClient();
      const serialized = JSON.stringify(clientSettings);

      assert.ok(!serialized.includes("smtp-secret-do-not-leak"));
      assert.equal(clientSettings.mail.smtp.passwordConfigured, true);
      assert.equal(clientSettings.mail.smtp.userConfigured, true);
    } finally {
      if (originalPassword === undefined) {
        delete process.env.SMTP_PASSWORD;
      } else {
        process.env.SMTP_PASSWORD = originalPassword;
      }
      if (originalUser === undefined) {
        delete process.env.SMTP_USER;
      } else {
        process.env.SMTP_USER = originalUser;
      }
      if (originalHost === undefined) {
        delete process.env.SMTP_HOST;
      } else {
        process.env.SMTP_HOST = originalHost;
      }
    }
  });

  it("stores portal SMTP credentials encrypted and never exposes password to clients", async () => {
    const service = createSettingsService(createPrismaClient(databaseUrl));
    const credentials = buildMailSmtpCredentialsUpdate({
      host: "smtp.portal.example",
      port: 587,
      secure: false,
      user: "portal@example.org",
      password: "portal-smtp-secret-do-not-leak",
      from: "UWE <portal@example.org>",
      useMock: false,
    });

    const updated = await service.updateSettings({
      mail: {
        enabled: true,
        fromDisplayName: "UWE Test",
        logBody: false,
        smtpCredentials: credentials,
      },
    });

    assert.equal(updated.mail.smtp.source, "portal");
    assert.equal(updated.mail.smtp.host, "smtp.portal.example");
    assert.equal(updated.mail.smtp.username, "portal@example.org");

    const clientSettings = await service.getSettingsForClient();
    const serialized = JSON.stringify(clientSettings);
    assert.ok(!serialized.includes("portal-smtp-secret-do-not-leak"));
    assert.equal(clientSettings.mail.smtp.source, "portal");
  });

  it("resolves session inactivity timeout from settings and env fallback", () => {
    const settings = {
      ...DEFAULT_SYSTEM_SETTINGS,
      auth: { sessionInactivityTimeoutMinutes: 15 },
    };

    assert.equal(resolveSessionInactivityTimeoutMs(settings), 15 * 60 * 1000);
    assert.equal(
      resolveSessionInactivityTimeoutMs({
        ...settings,
        auth: { sessionInactivityTimeoutMinutes: 0 },
      }),
      0,
    );
    assert.equal(
      resolveSessionInactivityTimeoutMs(
        {
          ...settings,
          auth: { sessionInactivityTimeoutMinutes: 0 },
        },
        { SESSION_INACTIVITY_TIMEOUT_MINUTES: "45" },
      ),
      45 * 60 * 1000,
    );
  });

  it("returns defaults from getSystemSettingsSnapshotSafe when the database read fails", async () => {
    const snapshot = await getSystemSettingsSnapshotSafe({
      systemSettings: {
        findUnique: async () => {
          throw new Error("database unavailable");
        },
      },
    } as unknown as ReturnType<typeof createPrismaClient>);

    assert.equal(snapshot.updatedAt, null);
    assert.equal(snapshot.settings.app.theme, DEFAULT_SYSTEM_SETTINGS.app.theme);
  });
});
