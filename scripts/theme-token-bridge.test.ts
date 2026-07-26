/**
 * Theme-Token-Bridge Guard.
 *
 * Jede App bridged die `--uwe-*` Theme-Tokens im `@theme`-Block ihrer
 * globals.css auf die semantischen Tailwind-Rollen (`--color-*`). Dabei ist eine
 * Verwechslung teuer und optisch schwer zu bemerken:
 *
 *   `--uwe-muted` ist ein Alt-Alias auf die gedämpfte TEXTfarbe
 *   (= `--uwe-fg-muted`), `muted` bei Tailwind/shadcn dagegen eine FLÄCHE.
 *
 * Wer beides verbrückt (`--color-muted: var(--uwe-muted)`), bekommt in
 * `bg-muted text-muted-foreground` zweimal dieselbe Farbe — Kontrast 1:1. Genau
 * das machte Badges, Setup-Tabs, `<pre>`-Blöcke, Dropdown-Einträge und die
 * Hover-Fläche von outline/ghost-Buttons in JEDEM Theme unlesbar.
 *
 * Der Test friert die Rollentrennung ein: Fläche aus einem Flächen-Token, Text
 * aus dem Text-Token. Bricht er, ist ein Bridge-Eintrag zurückgerutscht.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

/** Alle Tailwind-Bridges im Repo (globals.css mit `@theme`-Block). */
const BRIDGES = [
  "apps/studio/app/globals.css",
  "apps/portal/app/globals.css",
  "apps/brain/app/globals.css",
  "apps/rtx-connector-client/src/styles/globals.css",
] as const;

/** Tokens, die eine gedämpfte TEXTfarbe tragen — nie als Fläche verbrücken. */
const TEXT_TOKENS = ["--uwe-muted", "--uwe-fg-muted", "--uwe-fg-subtle"] as const;

/** Liest den Wert einer Custom Property aus dem `@theme`-Block. */
function readThemeDeclaration(css: string, property: string): string | null {
  const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(theme, "kein @theme-Block gefunden");
  // Kommentarzeilen raus, damit Erklärtexte keine Treffer liefern.
  const body = theme[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const match = new RegExp(`^\\s*${property}\\s*:\\s*([^;]+);`, "m").exec(body);
  return match ? match[1].trim() : null;
}

describe("theme token bridge", () => {
  for (const file of BRIDGES) {
    const css = fs.readFileSync(path.join(root, file), "utf8");

    it(`${file}: bridged --color-muted auf eine Fläche, nicht auf eine Textfarbe`, () => {
      const value = readThemeDeclaration(css, "--color-muted");
      assert.ok(value, `${file}: --color-muted fehlt im @theme-Block`);

      for (const token of TEXT_TOKENS) {
        // `\b` greift hier nicht: `--uwe-muted` ist Präfix von
        // `--uwe-muted-surface`. Also explizit auf das Ende des Token-Namens
        // prüfen — erlaubt bleibt nur ein längerer Name.
        const usesTextToken = new RegExp(`${token}(?![\\w-])`).test(value);
        assert.equal(
          usesTextToken,
          false,
          `${file}: --color-muted nutzt ${token} (gedämpfte Textfarbe) als Fläche — ` +
            `bg-muted und text-muted-foreground werden dieselbe Farbe. ` +
            `Flächen-Token nehmen, z. B. --uwe-muted-surface. Wert: ${value}`,
        );
      }
    });

    it(`${file}: --color-muted und --color-muted-foreground sind verschieden`, () => {
      const surface = readThemeDeclaration(css, "--color-muted");
      const foreground = readThemeDeclaration(css, "--color-muted-foreground");
      // Brain bridged (noch) kein muted-foreground — dann ist nichts zu prüfen.
      if (!surface || !foreground) return;
      assert.notEqual(
        surface,
        foreground,
        `${file}: Fläche und Text von 'muted' sind identisch (Kontrast 1:1)`,
      );
    });
  }

  it("das Flächen-Token existiert im shared-ui Token-Block", () => {
    const css = fs.readFileSync(
      path.join(root, "packages/shared-ui/src/uwe-components.css"),
      "utf8",
    );
    assert.match(
      css,
      /--uwe-muted-surface\s*:/,
      "--uwe-muted-surface fehlt in uwe-components.css — Studio und Portal bridgen darauf",
    );
  });
});
