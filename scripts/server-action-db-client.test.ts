/**
 * Server Actions must not build their own database connection.
 *
 * `createPrismaClient()` opens a NEW SQLite connection. Its own definition
 * warns about this — `getSharedPrismaClient` is documented as
 * "process-wide SQLite singleton — avoids lock storms from per-request
 * clients" — but a per-action call sidesteps that singleton entirely.
 *
 * Two failure modes, both measured on 2026-07-28:
 *
 *   1. Contention. SQLite serialises writers. Several fresh connections per
 *      interaction fight over the same lock.
 *   2. Leaks. A client that is never `$disconnect()`ed stays open for the
 *      lifetime of the process. Measured with connections left open the way
 *      `terra-actions.ts` used to leave them:
 *
 *        open connections     5     11     26     56
 *        per write         22 ms  17 ms  35 ms  250 ms
 *        shared client      0.6    0.5    0.4    1.5 ms
 *
 *      It degrades superlinearly and never recovers, because nothing closes
 *      those connections. An e2e run hit >20 s on two "new map" actions in
 *      quick succession — that is where this test comes from.
 *
 * The rule: Server Action files use the shared `prisma` client. Files that
 * legitimately need their own client (scripts, tests, migrations, anything
 * pointed at a second database) are not Server Actions and are not scanned.
 *
 * If a Server Action genuinely needs its own client — a different database
 * URL, say — it must disconnect it on every path, and it must await
 * `whenPragmasApplied()` first: `busy_timeout` reads back 0 immediately after
 * creation and only settles a few hundred milliseconds later. Add the file to
 * ERLAUBT below with a reason.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");

/** Directories whose *-actions.ts files are Server Actions. */
const ACTION_DIRS = [
  path.join(root, "apps", "studio", "app"),
  path.join(root, "apps", "portal", "app"),
];

/**
 * Files that still create their own client but DO close it on every path.
 * They pay the contention cost but not the leak, so they are tolerated for
 * now — the list must not grow, and shrinking it is a welcome change.
 *
 * Converting them is not a search-and-replace: each one calls `$disconnect()`,
 * and calling that on the *shared* client would tear down the singleton for
 * the whole process. Every removal from this list has to drop the matching
 * disconnect in the same edit.
 */
const CREATE_UND_DISCONNECT = [
  "apps/portal/app/character-actions.ts",
  "apps/portal/app/character-sheet-actions.ts",
  "apps/portal/app/note-actions.ts",
  "apps/portal/app/player-hub-actions.ts",
  "apps/portal/app/question-actions.ts",
  "apps/portal/app/treasury-actions.ts",
  "apps/studio/app/brain-actions.ts",
  "apps/studio/app/note-actions.ts",
  "apps/studio/app/settings-actions.ts",
  "apps/studio/app/share-actions.ts",
  "apps/studio/app/world-calendar-actions.ts",
];

function actionFiles(): string[] {
  const out: string[] = [];
  for (const dir of ACTION_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith("-actions.ts") && name !== "actions.ts") continue;
      out.push(path.join(dir, name));
    }
  }
  return out.sort();
}

describe("Server Actions share one database client", () => {
  it("finds the action files at all", () => {
    const files = actionFiles();
    assert.ok(
      files.length > 5,
      `Only ${files.length} action files found — the scan looks in the wrong place, ` +
        "and a guard that scans nothing passes forever",
    );
  });

  /** Source with comments stripped — this test's own rationale is quoted in
   *  terra-actions.ts, and a mention must not count as a call. */
  function code(file: string): string {
    return fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  it("a self-made client is always closed again", () => {
    // The acute defect: created and never disconnected, so the connection
    // survives the request. This is the one that must never come back.
    const leckt: string[] = [];

    for (const file of actionFiles()) {
      const src = code(file);
      if (!/\bcreatePrismaClient\s*\(/.test(src)) continue;
      if (/\$disconnect\s*\(|disconnectPrismaClientIfOwned\s*\(/.test(src)) continue;
      leckt.push(path.relative(root, file).replace(/\\/g, "/"));
    }

    assert.deepEqual(
      leckt,
      [],
      "These Server Actions open a database connection and never close it. " +
        "Use the shared `prisma` client — see the header of this file for the numbers.",
    );
  });

  it("the list of self-made clients does not grow", () => {
    const gefunden: string[] = [];

    for (const file of actionFiles()) {
      if (!/\bcreatePrismaClient\s*\(/.test(code(file))) continue;
      gefunden.push(path.relative(root, file).replace(/\\/g, "/"));
    }

    const neu = gefunden.filter((f) => !CREATE_UND_DISCONNECT.includes(f));
    assert.deepEqual(
      neu,
      [],
      "New Server Actions with their own database connection. Use the shared " +
        "`prisma` client instead; the known list is closed, not open.",
    );

    const weg = CREATE_UND_DISCONNECT.filter((f) => !gefunden.includes(f));
    assert.deepEqual(
      weg,
      [],
      "These files no longer create their own client — remove them from " +
        "CREATE_UND_DISCONNECT so the list stays honest.",
    );
  });
});
