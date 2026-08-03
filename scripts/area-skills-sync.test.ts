/**
 * Drift-Wächter für die vier Bereichs-Skills (/uwestudio /uweportal /uwebrain /uwefamily).
 *
 * Vorgeschichte: die Vorgänger dieser Skills waren handgepflegte Slash-Commands, und
 * nichts prüfte sie — `scripts/docs-check.mjs` scannt nur `docs`, `.cursor/commands`
 * und `.cursor/rules`. Ergebnis war stiller Drift:
 *
 *   - `/uweportal` machte `portal_leak_check` zur Pflicht, obwohl das Tool entfernt war
 *   - `/uwefamily` kannte `family_day_brief` am Tag seiner Einführung nicht
 *   - `/uweportal` zeigte auf `packages/database/src/permissions.ts` — verschoben nach
 *     `packages/auth/src/`
 *
 * Dieser Test macht genau diese drei Fehlerbilder zu einem roten Build:
 *
 *   1. Generierte Blöcke müssen dem Repo entsprechen  → `pnpm skills:sync`
 *   2. Jeder genannte Repo-Pfad muss existieren
 *   3. Jeder genannte MCP-Bezeichner muss ein echtes Tool sein
 *
 * Was der Test bewusst NICHT kann: die Prosa aktuell halten. Er erzwingt aber, dass
 * jemand hinsieht — ein neues Tool oder ein neuer Bereich lässt den Build kippen.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { createServer } from "../packages/mcp/src/servers";
import { AREAS, readBlock, renderAreaBlocks } from "./generate-area-skills";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

/**
 * Bezeichner im Muster `<fläche>_<name>`, die absichtlich in den Skills stehen,
 * ohne MCP-Tools zu sein. Jeder Eintrag braucht einen Grund — und darf kein
 * echtes Tool sein, sonst gehört er hier raus (wird unten geprüft).
 */
const NON_TOOL_IDENTIFIERS: Record<string, string> = {
  portal_leak_check: "Entferntes Tool. Steht bewusst da, damit niemand danach sucht.",
  family_read: "API-Token-Scope, kein Tool (packages/database/src/api-token-service.ts).",
  family_write: "API-Token-Scope, kein Tool.",
  family_calendar: "API-Token-Scope für Feeds, kein Tool.",
  family_shared: "Privacy-Klasse aus @uwe/product-contracts, kein Tool.",
};

/** Alle real registrierten Tools über alle vier Flächen, Freigaben aufgedreht. */
function allToolNames(): Set<string> {
  const env = {
    UWE_MCP_ALLOW_WRITES: "true",
    UWE_MCP_BRAIN_ALLOW_CONTENT: "true",
  } as NodeJS.ProcessEnv;
  const names = new Set<string>();
  for (const area of AREAS) {
    for (const tool of createServer(area.surface, env).tools) {
      names.add(tool.name);
    }
  }
  return names;
}

/** Repo-Pfade in Backticks. Muster mit `*`, `<…>` oder führendem `…` fallen raus. */
function referencedPaths(markdown: string): string[] {
  const found = new Set<string>();
  for (const match of markdown.matchAll(/`((?:apps|packages|docs|scripts)\/[^`\s]+)`/g)) {
    const candidate = match[1].replace(/[.,;:]$/, "");
    if (/[*<>]/.test(candidate) || candidate.includes("...")) continue;
    found.add(candidate.replace(/\/$/, ""));
  }
  return [...found];
}

function referencedToolIdentifiers(markdown: string): string[] {
  const found = new Set<string>();
  for (const match of markdown.matchAll(/`((?:studio|portal|brain|family)_[a-z_]+)`/g)) {
    found.add(match[1]);
  }
  return [...found];
}

const skillFiles = AREAS.map((area) => `.claude/skills/${area.id}/SKILL.md`);
const karteFiles = AREAS.map((area) => `.claude/skills/${area.id}/references/karte.md`);

describe("Bereichs-Skills: Aufbau", () => {
  for (const area of AREAS) {
    it(`${area.id} hat SKILL.md und references/karte.md`, () => {
      assert.ok(exists(`.claude/skills/${area.id}/SKILL.md`), `${area.id}: SKILL.md fehlt`);
      assert.ok(
        exists(`.claude/skills/${area.id}/references/karte.md`),
        `${area.id}: references/karte.md fehlt`,
      );
    });

    it(`${area.id} hat gültiges Frontmatter`, () => {
      const content = read(`.claude/skills/${area.id}/SKILL.md`);
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      assert.ok(frontmatter, `${area.id}: kein YAML-Frontmatter am Dateianfang`);

      const name = /^name:\s*(\S+)\s*$/m.exec(frontmatter[1])?.[1];
      assert.equal(name, area.id, `${area.id}: 'name' muss dem Ordnernamen entsprechen`);

      const description = /^description:\s*(.+)$/m.exec(frontmatter[1])?.[1];
      assert.ok(
        description && description.length >= 40,
        `${area.id}: 'description' fehlt oder ist zu knapp — daran wird der Skill ausgelöst`,
      );
    });
  }

  it("kein gleichnamiger Slash-Command daneben", () => {
    // Ein Command `/uwestudio` UND ein Skill `uwestudio` wären mehrdeutig.
    const collisions = AREAS.map((area) => `.claude/commands/${area.id}.md`).filter(exists);
    assert.deepEqual(
      collisions,
      [],
      `Namenskollision mit .claude/skills/: ${collisions.join(", ")} löschen`,
    );
  });
});

describe("Bereichs-Skills: generierte Blöcke", () => {
  for (const block of renderAreaBlocks()) {
    it(`${block.file} — Block '${block.id}' ist aktuell`, () => {
      const current = readBlock(read(block.file), block.id, block.file);
      assert.equal(
        current,
        block.body,
        `${block.file}: Block '${block.id}' weicht vom Repo ab.\n` +
          "Beheben: pnpm skills:sync — danach den Prosa-Teil des Skills nachziehen.",
      );
    });
  }
});

describe("Bereichs-Skills: Verweise stimmen", () => {
  for (const file of [...skillFiles, ...karteFiles]) {
    it(`${file} nennt nur existierende Pfade`, () => {
      const missing = referencedPaths(read(file)).filter((candidate) => !exists(candidate));
      assert.deepEqual(missing, [], `${file}: verwaiste Pfade — ${missing.join(", ")}`);
    });
  }

  const tools = allToolNames();

  for (const file of skillFiles) {
    it(`${file} nennt nur echte MCP-Tools`, () => {
      const unknown = referencedToolIdentifiers(read(file)).filter(
        (name) => !tools.has(name) && !(name in NON_TOOL_IDENTIFIERS),
      );
      assert.deepEqual(
        unknown,
        [],
        `${file}: unbekannte Tool-Bezeichner — ${unknown.join(", ")}. ` +
          "Entweder Tippfehler, oder das Tool ist weg: Text korrigieren oder in " +
          "NON_TOOL_IDENTIFIERS mit Grund eintragen.",
      );
    });
  }

  it("NON_TOOL_IDENTIFIERS enthält keine echten Tools", () => {
    const stale = Object.keys(NON_TOOL_IDENTIFIERS).filter((name) => tools.has(name));
    assert.deepEqual(
      stale,
      [],
      `Diese Bezeichner sind (wieder) echte Tools und gehören aus der Ausnahmeliste: ${stale.join(", ")}`,
    );
  });
});
