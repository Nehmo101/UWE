import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const portalLayoutPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../app/layout.tsx",
);

describe("portal theme sync layout", () => {
  it("reads server theme from settings and applies ThemeDocumentSync", () => {
    const layout = readFileSync(portalLayoutPath, "utf8");

    assert.match(layout, /getSystemSettingsSnapshotSafe\(\)/);
    assert.match(layout, /resolveThemePreferencesForScope\(settings\.app, "portal"\)/);
    assert.match(layout, /buildVisualThemeHtmlAttributes\(settings\.app/);
    assert.match(layout, /ThemeBootstrapScript[\s\S]*scope="portal"/);
    assert.match(layout, /const serverTheme: ThemeAppearance = settings\.app\.theme/);
    assert.match(layout, /<ThemeDocumentSync theme=\{serverTheme\} \/>/);
    assert.match(layout, /PortalThemeSyncProvider/);
  });
});
