import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateSettingsUpdate } from "./settings-validation";

describe("validateSettingsUpdate", () => {
  it("accepts visual polish app settings", () => {
    const result = validateSettingsUpdate({
      app: {
        theme: "dark",
        backgroundPattern: "synapse",
        frostedGlass: true,
        motionEnabled: false,
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.value.app, {
      theme: "dark",
      backgroundPattern: "synapse",
      frostedGlass: true,
      motionEnabled: false,
    });
  });

  it("rejects invalid background pattern", () => {
    const result = validateSettingsUpdate({
      app: { backgroundPattern: "matrix" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.app.backgroundPattern")));
  });

  it("accepts a valid partial update", () => {
    const result = validateSettingsUpdate({
      app: { theme: "light" },
      worlds: { defaultCanonicalStatus: "canon" },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.value, {
      app: { theme: "light" },
      worlds: { defaultCanonicalStatus: "canon" },
    });
  });

  it("accepts the passkeysEnabled auth toggle", () => {
    const result = validateSettingsUpdate({
      auth: { passkeysEnabled: true },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.value.auth, { passkeysEnabled: true });
  });

  it("rejects a non-boolean passkeysEnabled value", () => {
    const result = validateSettingsUpdate({
      auth: { passkeysEnabled: "yes" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.auth.passkeysEnabled")));
  });

  it("rejects unknown auth keys", () => {
    const result = validateSettingsUpdate({
      auth: { passkeyRpId: "evil.example" },
    });

    assert.equal(result.ok, false);
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

  it("accepts a briefing auto-toggle update", () => {
    const result = validateSettingsUpdate({
      briefing: { autoBriefingEnabled: true, time: "06:30" },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.briefing?.autoBriefingEnabled, true);
    assert.equal(result.value.briefing?.time, "06:30");
  });

  it("rejects non-boolean autoBriefingEnabled", () => {
    const result = validateSettingsUpdate({
      briefing: { autoBriefingEnabled: "on" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(
      result.errors.some((error) => error.includes("settings.briefing.autoBriefingEnabled")),
    );
  });

  it("rejects an invalid briefing time", () => {
    const result = validateSettingsUpdate({
      briefing: { time: "25:99" },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.ok(result.errors.some((error) => error.includes("settings.briefing.time")));
  });
});

/**
 * Abdeckungs-Inventar: Systemeinstellungen werden seit Abschnitt D33 nicht mehr
 * in Studio gepflegt, sondern in der Kommandozentrale (`SETTINGS_GROUPS` in
 * `apps/rtx-connector-client/src/components/ops/settings-fields.ts`). Beide
 * Seiten können nicht gemeinsam getestet werden — die Kommandozentrale ist ein
 * Frontend und darf `@uwe/database` nicht importieren.
 *
 * Also wird hier die schreibbare Fläche festgenagelt. Wer eine Einstellung
 * ergänzt, bricht diesen Test und wird damit an das zugehörige Feld erinnert:
 * eine Einstellung ohne Feld ist eine, die niemand findet.
 *
 * `app` steht bewusst nicht in der Liste — Design und Startseite bleiben in
 * Studio, wo man sie sieht.
 */
const SETTINGS_WRITABLE_BY_COMMAND_CENTER: Record<string, string[]> = {
  worlds: ["defaultCanonicalStatus"],
  campaigns: ["inheritWorldDefaults"],
  portal: ["portalEnabled"],
  ai: ["localOnlyMode", "enabled", "generalChatSystemPrompt"],
  mail: [
    "enabled",
    "fromDisplayName",
    "logBody",
    "inboxLimit",
    "autoSyncEnabled",
    "autoSyncIntervalMinutes",
  ],
  imageStudio: ["enabled", "backgroundRemovalEnabled"],
  storage: ["uploadsPath", "exportsPath"],
  backup: ["backupsPath", "autoBackupEnabled", "retentionCount"],
  briefing: ["autoBriefingEnabled", "time"],
  privacy: ["maskSecretsInUi", "restrictPublicExport"],
  auth: [
    "sessionInactivityTimeoutMinutes",
    "passkeysEnabled",
    "googleLoginEnabled",
    "googleClientId",
  ],
  maintenance: ["maintenanceMode", "lockPortal", "lockStudio", "message"],
};

describe("Kommandozentrale-Abdeckung", () => {
  it("akzeptiert jede Einstellung, für die die Kommandozentrale ein Feld hat", () => {
    for (const [group, keys] of Object.entries(SETTINGS_WRITABLE_BY_COMMAND_CENTER)) {
      for (const key of keys) {
        // Ein bewusst falscher Typ: Der Validator darf über den *Wert* meckern,
        // aber niemals über den Schlüssel — sonst hat die Karte ein Feld, das
        // beim Speichern kommentarlos abprallt.
        const result = validateSettingsUpdate({ [group]: { [key]: undefined } });
        const unknownKeyError = result.ok
          ? undefined
          : result.errors.find((error) => error.includes("Unbekannt") || error.includes("unknown"));
        assert.equal(unknownKeyError, undefined, `settings.${group}.${key} wird abgelehnt`);
      }
    }
  });

  it("kennt keine schreibbare Einstellung ohne Feld in der Kommandozentrale", () => {
    // Ein unbekannter Gruppenname muss abgelehnt werden. Schlägt das fehl, ist
    // der Validator offener geworden als das Inventar hier abbildet.
    const result = validateSettingsUpdate({ nichtImInventar: { irgendwas: true } });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((error) => error.includes("nichtImInventar")));
  });
});
