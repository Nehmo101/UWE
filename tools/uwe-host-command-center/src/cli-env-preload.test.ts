import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Hält die Importreihenfolge der CLIs fest.
 *
 * `@uwe/database` legt seine Prisma-Clients beim Modulladen an. Steht das
 * Laden der `.env` nicht im allerersten Import, sehen diese Singletons kein
 * `DATABASE_URL` / `BRAIN_DATABASE_URL` mehr und fallen auf
 * `packages/database/data/*.db` zurück — auf dem Host existiert das nicht, und
 * die Secrets-Ansicht der Kommandozentrale scheiterte an
 * `ConnectionFailed("… uwe-brain.db: 14")`.
 *
 * Eine Quelltextprüfung statt eines Laufzeittests, weil genau die Reihenfolge
 * im Quelltext die Garantie ist: zur Laufzeit ist der Fehler nur auf einem Host
 * ohne `packages/database/data/` sichtbar.
 */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Der erste `import`-Ausdruck einer Datei — Kommentare zählen nicht. */
function firstImport(file: string): string {
  const source = fs.readFileSync(path.join(here, file), "utf8");
  const match = source.match(/^import\s.*$/m);
  assert.ok(match, `${file} hat keinen Import`);
  return match[0];
}

describe("cli env preload", () => {
  for (const file of ["ops-cli.ts", "user-admin-cli.ts"]) {
    it(`${file} lädt die .env im ersten Import`, () => {
      assert.match(firstImport(file), /^import "\.\/cli-env-preload";$/);
    });
  }

  it("das Preload-Modul ruft nur den .env-Loader auf", () => {
    const source = fs.readFileSync(path.join(here, "cli-env-preload.ts"), "utf8");
    assert.match(source, /^loadEnvFromRoot\(\);$/m);

    // Nur die Import-Zeilen prüfen: ein `@uwe/…` im Fließtext ist erlaubt,
    // ein Paket-Import wäre der Fehler — er liefe vor dem .env-Laden.
    for (const line of source.match(/^import\s.*$/gm) ?? []) {
      assert.doesNotMatch(line, /@uwe\//, `Paket-Import im Preload-Modul: ${line}`);
    }
  });
});
