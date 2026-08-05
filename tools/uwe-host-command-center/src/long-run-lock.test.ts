import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  LongRunLockedError,
  longRunLockFile,
  readLongRunLock,
  withLongRunLock,
} from "./long-run-lock";

const temporaryDirectories: string[] = [];
const previousDataDir = process.env.UWE_COMMAND_CENTER_DATA_DIR;

afterEach(() => {
  if (previousDataDir === undefined) delete process.env.UWE_COMMAND_CENTER_DATA_DIR;
  else process.env.UWE_COMMAND_CENTER_DATA_DIR = previousDataDir;
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/** Legt ein isoliertes Datenverzeichnis an und macht es zum Host-Datenort. */
function isolatedDataRoot(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-long-run-lock-"));
  temporaryDirectories.push(directory);
  process.env.UWE_COMMAND_CENTER_DATA_DIR = directory;
  return directory;
}

/** Eine PID, die garantiert zu keinem lebenden Prozess gehört. */
function deadPid(): number {
  let candidate = 999_000;
  while (candidate < 1_000_000) {
    try {
      process.kill(candidate, 0);
    } catch {
      return candidate;
    }
    candidate += 1;
  }
  throw new Error("keine freie PID gefunden");
}

function writeLockFile(root: string, content: unknown): void {
  const file = longRunLockFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(content)}\n`);
}

describe("long run lock", () => {
  it("runs the action and clears the lock afterwards", async () => {
    const root = isolatedDataRoot();

    const seen: string[] = [];
    const result = await withLongRunLock(root, "setup", async () => {
      seen.push(readLongRunLock(root)?.action ?? "keine");
      return "fertig";
    });

    assert.equal(result, "fertig");
    assert.deepEqual(seen, ["setup"]);
    assert.equal(readLongRunLock(root), null);
    assert.equal(fs.existsSync(longRunLockFile(root)), false);
  });

  /*
   * Der Fehler vom 2026-08-04: Ein Setup aus der GUI lief in einen bereits
   * laufenden CLI-Lauf hinein, beide bauten über dieselben .next-Verzeichnisse.
   */
  it("refuses a second long run and never touches its action", async () => {
    const root = isolatedDataRoot();

    await withLongRunLock(root, "setup", async () => {
      let started = false;
      await assert.rejects(
        withLongRunLock(root, "setup", async () => {
          started = true;
        }),
        (error: unknown) => {
          assert.ok(error instanceof LongRunLockedError);
          assert.equal(error.holder.pid, process.pid);
          assert.match(error.message, /Es läuft bereits Einrichtung/);
          return true;
        },
      );
      assert.equal(started, false, "die zweite Aktion darf gar nicht erst anlaufen");
    });
  });

  it("blocks an update while a setup runs — the two share one lock", async () => {
    const root = isolatedDataRoot();

    await withLongRunLock(root, "setup", async () => {
      await assert.rejects(
        withLongRunLock(root, "update", async () => undefined),
        LongRunLockedError,
      );
    });
  });

  it("releases the lock when the action throws", async () => {
    const root = isolatedDataRoot();

    await assert.rejects(
      withLongRunLock(root, "setup", async () => {
        throw new Error("Build fehlgeschlagen");
      }),
      /Build fehlgeschlagen/,
    );

    assert.equal(readLongRunLock(root), null);
  });

  /*
   * Ein abgeschossener Lauf hinterlässt seine Sperrdatei. Ohne PID-Prüfung
   * bliebe der Rechner dauerhaft gesperrt — reparierbar nur per Hand.
   */
  it("takes over a lock whose process is gone", async () => {
    const root = isolatedDataRoot();
    writeLockFile(root, { action: "setup", pid: deadPid(), startedAt: "2026-08-04T21:15:20.715Z" });

    assert.equal(readLongRunLock(root), null, "eine verwaiste Sperre zählt nicht als laufender Vorgang");

    const result = await withLongRunLock(root, "setup", async () => "übernommen");

    assert.equal(result, "übernommen");
  });

  it("takes over an unreadable lock file", async () => {
    const root = isolatedDataRoot();
    const file = longRunLockFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "kein JSON");

    assert.equal(readLongRunLock(root), null);
    assert.equal(await withLongRunLock(root, "setup", async () => "übernommen"), "übernommen");
  });

  it("reports the running action to the status while it works", async () => {
    const root = isolatedDataRoot();

    await withLongRunLock(root, "update", async () => {
      const info = readLongRunLock(root);
      assert.equal(info?.action, "update");
      assert.equal(info?.pid, process.pid);
      assert.ok(Number.isFinite(Date.parse(info?.startedAt ?? "")), "startedAt ist ein ISO-Zeitpunkt");
    });
  });
});
