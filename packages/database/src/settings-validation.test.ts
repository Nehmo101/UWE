import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSettingsUpdate } from "./settings-validation";

describe("validateSettingsUpdate", () => {
  it("accepts a valid partial update", () => {
    const result = validateSettingsUpdate({
      app: { theme: "light" },
      worlds: { defaultVisibility: "player_visible" },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.value, {
      app: { theme: "light" },
      worlds: { defaultVisibility: "player_visible" },
    });
  });

  it("rejects unknown top-level keys", () => {
    const result = validateSettingsUpdate({
      app: { theme: "dark" },
      hackerField: true,
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.hackerField")));
  });

  it("rejects unknown nested keys", () => {
    const result = validateSettingsUpdate({
      portal: { portalEnabled: true, extraFlag: true },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.portal.extraFlag")));
  });

  it("rejects invalid enum values", () => {
    const result = validateSettingsUpdate({
      app: { theme: "neon" },
      worlds: { defaultCanonicalStatus: "approved" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.app.theme")));
    assert.ok(result.errors.some((error) => error.includes("settings.worlds.defaultCanonicalStatus")));
  });

  it("rejects wrong types", () => {
    const result = validateSettingsUpdate({
      ai: { enabled: "yes" },
      backup: { autoBackupEnabled: 1 },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.ai.enabled")));
    assert.ok(result.errors.some((error) => error.includes("settings.backup.autoBackupEnabled")));
  });

  it("rejects unsafe storage paths", () => {
    const result = validateSettingsUpdate({
      storage: { uploadsPath: "../../etc/passwd", exportsPath: "C:\\Windows\\System32" },
      backup: { backupsPath: "/etc/shadow" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.storage.uploadsPath")));
    assert.ok(result.errors.some((error) => error.includes("settings.storage.exportsPath")));
    assert.ok(result.errors.some((error) => error.includes("settings.backup.backupsPath")));
  });

  it("accepts exportsPath in storage updates", () => {
    const result = validateSettingsUpdate({
      storage: { exportsPath: "./exports/custom" },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.storage?.exportsPath, "./exports/custom");
  });

  it("rejects disabling maskSecretsInUi", () => {
    const result = validateSettingsUpdate({
      privacy: { maskSecretsInUi: false },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("maskSecretsInUi")));
  });

  it("rejects ai provider placeholders from client updates", () => {
    const result = validateSettingsUpdate({
      ai: { providerKeyPlaceholders: [] },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(
      result.errors.some((error) => error.includes("settings.ai.providerKeyPlaceholders")),
    );
  });
});
