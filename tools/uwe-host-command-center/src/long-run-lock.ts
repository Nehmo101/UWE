import fs from "node:fs";
import path from "node:path";

import { ensureHostDirectories, pathsFor, resolveDesktopHostRoot } from "./desktop-host-paths.ts";
import { processRunning } from "./desktop-host-system.ts";
import type { LongRunAction, LongRunLockInfo } from "./desktop-host-types.ts";

export type { LongRunAction, LongRunLockInfo };

/**
 * Sperre für die minutenlangen Host-Aktionen (Einrichtung, Update).
 *
 * Ohne sie können zwei Läufe gleichzeitig über denselben Baum arbeiten: der
 * Command-Center-Knopf und die CLI kennen einander nicht, und beide landen in
 * derselben `desktop-host-cli`-Aktion. Real passiert am 2026-08-04 — ein
 * CLI-Setup baute gerade Studio neu, während ein aus der GUI gestarteter
 * zweiter Lauf `pnpm build` über dieselben `.next`-Verzeichnisse schickte.
 *
 * Bewusst eine Datei statt eines In-Process-Flags: die beiden Läufe sind
 * verschiedene Prozesse. Bewusst mit PID statt bloßer Existenz: ein abgestürzter
 * oder abgeschossener Lauf darf den Rechner nicht dauerhaft blockieren — eine
 * Sperre ohne lebenden Prozess gilt als verwaist und wird übernommen.
 */

const LOCK_FILE = "long-run.lock";

const ACTION_LABELS: Record<LongRunAction, string> = {
  setup: "Einrichtung",
  update: "Update",
  "bundle-install": "Installation",
  "bundle-update": "Update",
};

/** Wird als Ergebnis der Aktion gemeldet, nicht als Absturz — die CLI fängt sie. */
export class LongRunLockedError extends Error {
  readonly holder: LongRunLockInfo;

  constructor(holder: LongRunLockInfo) {
    super(
      `Es läuft bereits ${ACTION_LABELS[holder.action]} (seit ${holder.startedAt}, Prozess ${holder.pid}). ` +
        "Warte, bis der Lauf fertig ist — zwei gleichzeitige Läufe bauen über dieselben Verzeichnisse.",
    );
    this.name = "LongRunLockedError";
    this.holder = holder;
  }
}

export function longRunLockFile(rootInput?: string): string {
  return path.join(pathsFor(resolveDesktopHostRoot(rootInput)).runtime, LOCK_FILE);
}

function parseLock(raw: string): LongRunLockInfo | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LongRunLockInfo>;
    if (typeof parsed.pid !== "number" || !Number.isInteger(parsed.pid) || parsed.pid <= 0) return null;
    if (typeof parsed.action !== "string" || !(parsed.action in ACTION_LABELS)) return null;
    if (typeof parsed.startedAt !== "string") return null;
    return { action: parsed.action as LongRunAction, pid: parsed.pid, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

/**
 * Der aktive Lauf, oder `null`. Eine Sperre ohne lebenden Prozess zählt als
 * verwaist und wird hier schon aufgeräumt — sonst meldete der Status noch
 * stundenlang „Einrichtung läuft" für einen Lauf, den es nicht mehr gibt.
 */
export function readLongRunLock(rootInput?: string): LongRunLockInfo | null {
  const file = longRunLockFile(rootInput);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }

  const info = parseLock(raw);
  if (info && processRunning(info.pid)) return info;

  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Aufräumen ist Kür: der nächste `acquire` übernimmt die Sperre ohnehin.
  }
  return null;
}

function acquire(file: string, action: LongRunAction): void {
  const payload: LongRunLockInfo = {
    action,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };

  // `wx` legt die Datei atomar an und scheitert, wenn sie existiert — anders als
  // „erst existsSync, dann schreiben" gibt es hier kein Fenster, in dem zwei
  // Läufe beide freie Bahn sehen.
  const write = (): boolean => {
    try {
      fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  };

  if (write()) return;

  let existing: LongRunLockInfo | null = null;
  try {
    existing = parseLock(fs.readFileSync(file, "utf8"));
  } catch {
    existing = null;
  }

  if (existing && processRunning(existing.pid)) throw new LongRunLockedError(existing);

  // Verwaiste oder unlesbare Sperre: übernehmen. Ein einziger erneuter Versuch
  // genügt — verliert man auch den, hält ein anderer Lauf die Sperre gerade
  // frisch, und genau dann soll man scheitern.
  fs.rmSync(file, { force: true });
  if (write()) return;

  const winner = parseLock(fs.readFileSync(file, "utf8"));
  throw new LongRunLockedError(winner ?? { action, pid: 0, startedAt: new Date().toISOString() });
}

function release(file: string): void {
  try {
    const current = parseLock(fs.readFileSync(file, "utf8"));
    // Nur die eigene Sperre freigeben: hat ein anderer Lauf sie inzwischen
    // übernommen (weil dieser hier als verwaist galt), gehört sie ihm.
    if (current && current.pid !== process.pid) return;
    fs.rmSync(file, { force: true });
  } catch {
    // Schon weg — nichts zu tun.
  }
}

/**
 * Führt `run` unter der Sperre aus. Läuft bereits eine lange Aktion, wirft die
 * Funktion `LongRunLockedError`, **ohne** `run` anzufassen.
 */
export async function withLongRunLock<T>(
  rootInput: string | undefined,
  action: LongRunAction,
  run: () => Promise<T>,
): Promise<T> {
  ensureHostDirectories(pathsFor(resolveDesktopHostRoot(rootInput)));
  const file = longRunLockFile(rootInput);
  acquire(file, action);
  try {
    return await run();
  } finally {
    release(file);
  }
}
