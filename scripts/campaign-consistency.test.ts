import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Kampagnen-Konsistenz ist Teil aller relevanten Gates", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts["test:ci"], /campaign-consistency\.test\.ts/);
  assert.match(pkg.scripts["test:ci:affected"], /campaign-consistency\.test\.ts/);
  assert.match(pkg.scripts.test, /campaign-consistency\.test\.ts/);
  assert.match(pkg.scripts["campaign:check"], /campaign-consistency-check\.ts/);
});

test("beide Datenbankschemata enthalten dieselben Kampagnen-Strukturmodelle", async () => {
  for (const name of ["schema.prisma", "schema.postgresql.prisma"]) {
    const schema = await readFile(new URL(`../packages/database/prisma/${name}`, import.meta.url), "utf8");
    for (const model of ["Dungeon", "GameSessionFocus", "DocImportSource", "DocImportPageBinding"]) {
      assert.match(schema, new RegExp(`model ${model} \\{`));
    }
    assert.match(schema, /questStoryArcId\s+String\?/);
  }
});
