import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Der Standalone-Baum einer App ist nach `next build` unvollständig.
 *
 * Next.js legt dort weder `static/` noch `public/` ab — eine dokumentierte
 * Upstream-Eigenschaft. Der Host startet aber genau diesen Server. Fehlt der
 * Kopierschritt, liefert er vollständiges HTML aus, während jede
 * `/_next/static/*`-URL 404t: **jede Seite ohne Design, in allen Apps
 * gleichzeitig**. Genau das ist am 2026-07-30 im Betrieb passiert, weil der
 * Schritt nur am Root-Skript hing und ein App-Build ihn nicht auslöste.
 *
 * Deshalb hängt er jetzt an jedem App-Build. Dieser Test hält das fest.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["studio", "portal", "brain", "family", "landing"] as const;

function buildScript(app: string): string {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "apps", app, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const build = manifest.scripts?.build;
  assert.ok(build, `apps/${app} hat kein build-Skript`);
  return build;
}

describe("Standalone-Assets hängen am App-Build", () => {
  for (const app of APPS) {
    it(`${app}: materialisiert sich nach dem next build selbst`, () => {
      const build = buildScript(app);
      const call = `materialize-standalone-prisma-deps.mjs ${app}`;

      assert.ok(
        build.includes(call),
        `apps/${app}: build ruft "${call}" nicht auf — der Standalone-Baum bliebe ohne static/ und public/`,
      );
      assert.ok(
        build.indexOf("next build") < build.indexOf(call),
        `apps/${app}: der Kopierschritt muss nach "next build" laufen, sonst kopiert er den alten Stand`,
      );
    });
  }

  it("das Materialize-Skript kennt genau diese Apps", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "scripts", "materialize-standalone-prisma-deps.mjs"),
      "utf8",
    );
    const list = source.match(/^const APPS = \[(.*)\];$/m);
    assert.ok(list, "APPS-Liste im Materialize-Skript nicht gefunden");

    const names = [...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(names, [...APPS]);
  });

  it("nimmt eine App als Argument entgegen", () => {
    // Ohne Filter kopierte ein App-Build die vier anderen mit — und der teure
    // `pnpm deploy` liefe fünfmal statt einmal.
    const source = fs.readFileSync(
      path.join(ROOT, "scripts", "materialize-standalone-prisma-deps.mjs"),
      "utf8",
    );
    assert.match(source, /process\.argv\.slice\(2\)/);
    assert.match(source, /requested\.length > 0 \? requested : APPS/);
  });

  it("legt das Elternverzeichnis vor dem atomaren Lock an", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "scripts", "materialize-standalone-prisma-deps.mjs"),
      "utf8",
    );
    const parentMkdir = "fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true });";
    const lockMkdir = "fs.mkdirSync(LOCK_DIR);";

    assert.ok(
      source.includes(parentMkdir),
      "ein frischer Runner hat noch kein .cache-Verzeichnis",
    );
    assert.ok(
      source.indexOf(parentMkdir) < source.indexOf(lockMkdir),
      "das Elternverzeichnis muss vor dem atomaren Lock existieren",
    );
  });
});
