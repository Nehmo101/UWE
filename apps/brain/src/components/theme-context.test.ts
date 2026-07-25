import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Regression: Die BrainShell trägt seit dem Ghibli-Redesign den
 * Hell/Dunkel-Umschalter in der Topbar. Der liest `useUweTheme()` und wirft
 * ohne Provider — jede Brain-Seite endete dann in Nexts
 * „Application error: a client-side exception has occurred".
 *
 * Der Test prüft die Verdrahtung an der Quelle, weil ein echtes Rendern des
 * Root-Layouts die Next-Runtime (Fonts, DB, Metadata) bräuchte.
 */

const appDir = path.join(__dirname, "..", "..", "app");
const componentsDir = __dirname;

const read = (file: string) => readFileSync(file, "utf8");

/** Shared-UI-Komponenten, die zwingend im Theme-Kontext stehen müssen. */
const THEME_CONTEXT_CONSUMERS = ["ThemeModeToggle", "ThemeSettingsPanel"];

describe("brain theme context wiring", () => {
  it("wraps the whole app in a brain-scoped ThemeProvider", () => {
    const layout = read(path.join(appDir, "layout.tsx"));
    assert.match(
      layout,
      /<BrainThemeSyncProvider[\s\S]*\{children\}[\s\S]*<\/BrainThemeSyncProvider>/,
      "layout.tsx must render {children} inside BrainThemeSyncProvider",
    );

    const provider = read(path.join(componentsDir, "BrainThemeSyncProvider.tsx"));
    assert.match(provider, /^"use client";/, "provider must be a client component");
    assert.match(provider, /<ThemeProvider/, "provider must mount the shared ThemeProvider");
    assert.match(provider, /scope="brain"/, "provider must use the brain theme scope");
  });

  it("keeps every theme-context consumer in the shell below that provider", () => {
    const shell = read(path.join(componentsDir, "BrainShell.tsx"));
    const used = THEME_CONTEXT_CONSUMERS.filter((name) =>
      new RegExp(`<${name}[\\s/>]`).test(shell),
    );
    assert.ok(
      used.length > 0,
      "expected the shell to render at least one theme-context consumer — " +
        "if that changed, update THEME_CONTEXT_CONSUMERS instead of deleting this test",
    );

    // Die Shell selbst darf keinen eigenen Provider mitbringen: der Kontext
    // gehört ins Root-Layout, sonst hängt jede Unterseite an ihrem eigenen
    // State und der Umschalter verliert die Persistenz.
    assert.doesNotMatch(shell, /<ThemeProvider/);
  });
});
