import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createPage, createWorld } from "./repository";
import {
  DEFAULT_SYSTEM_SETTINGS,
  createSettingsService,
  isGuestPortalAccessAllowed,
  resolveLocalOnlyMode,
} from "./settings-service";
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
    assert.equal(settings.worlds.defaultVisibility, "dm_only");
    assert.equal(settings.portal.portalEnabled, true);
    assert.equal(settings.ai.localOnlyMode, false);
  });

  it("persists and reloads settings", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);

    await service.updateSettings({
      app: { theme: "light" },
      worlds: { defaultVisibility: "player_visible", defaultCanonicalStatus: "canon" },
      portal: { guestAccessEnabled: false, publicSharingEnabled: false },
      ai: { localOnlyMode: true },
      storage: { uploadsPath: "./custom-uploads" },
      backup: { backupsPath: "./custom-backups" },
    });

    const reloaded = await service.getSettings();
    assert.equal(reloaded.app.theme, "light");
    assert.equal(reloaded.worlds.defaultVisibility, "player_visible");
    assert.equal(reloaded.worlds.defaultCanonicalStatus, "canon");
    assert.equal(reloaded.portal.guestAccessEnabled, false);
    assert.equal(reloaded.ai.localOnlyMode, true);
    assert.equal(reloaded.storage.uploadsPath, "./custom-uploads");
    assert.equal(reloaded.backup.backupsPath, "./custom-backups");
  });

  it("uses default visibility when creating pages", async () => {
    const db = createPrismaClient(databaseUrl);
    const service = createSettingsService(db);

    await service.updateSettings({
      worlds: { defaultVisibility: "player_visible", defaultCanonicalStatus: "canon" },
    });

    const world = await createWorld(
      { name: "Settings Test", slug: "settings-test", description: null },
      databaseUrl,
    );

    const page = await createPage(
      {
        worldId: world.id,
        title: "Default Page",
        slug: "default-page",
        type: "lore",
      },
      databaseUrl,
    );

    assert.equal(page.visibility, "player_visible");
    assert.equal(page.canonicalStatus, "canon");
  });

  it("guest access setting controls portal guest access", async () => {
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
      portal: { guestAccessEnabled: false },
    });

    const disabledSettings = await service.getSettings();
    const ctxDisabled = await auth.buildAccessContextForWorld("guest-world");
    assert.ok(ctxDisabled);
    assert.equal(
      isGuestPortalAccessAllowed(disabledSettings, true),
      false,
    );
    assert.equal(ctxDisabled.guestModeEnabled, false);

    await service.updateSettings({
      portal: { guestAccessEnabled: true },
    });

    const ctxEnabled = await auth.buildAccessContextForWorld("guest-world");
    assert.ok(ctxEnabled);
    assert.equal(ctxEnabled.guestModeEnabled, true);
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
      worlds: { defaultVisibility: "player_visible", defaultCanonicalStatus: "canon" },
      portal: { guestAccessEnabled: false, publicSharingEnabled: false },
      ai: { localOnlyMode: true, enabled: false },
    });

    await service.updateSettings({
      app: { theme: "dark" },
    });

    const settings = await service.getSettings();
    assert.equal(settings.app.theme, "dark");
    assert.equal(settings.worlds.defaultVisibility, "player_visible");
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
});
