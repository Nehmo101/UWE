import { execFile } from "node:child_process";
import fs from "node:fs/promises";

/**
 * Injectable side-effect surface for the collectors. Everything the host
 * monitor reads from the OS goes through these, so tests can supply fakes and
 * never touch the real host. Defaults are read-only, time-boxed and never throw.
 */

export interface CommandResult {
  stdout: string;
  code: number;
}

/** Runs a command with fixed args (no shell). Resolves null when unavailable. */
export type CommandRunner = (cmd: string, args: string[]) => Promise<CommandResult | null>;

export interface HostReadDeps {
  run: CommandRunner;
  readFile: (path: string) => Promise<string | null>;
  fileExists: (path: string) => Promise<boolean>;
}

const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_MAX_BUFFER = 1024 * 1024;

/**
 * Default runner: `execFile` with a fixed argument array (never a shell string,
 * so no interpolation risk), a timeout and a bounded buffer. A missing binary
 * (ENOENT) resolves to null; a non-zero exit still resolves with its output so
 * callers can degrade gracefully instead of crashing.
 */
export function defaultCommandRunner(): CommandRunner {
  return (cmd, args) =>
    new Promise((resolve) => {
      execFile(
        cmd,
        args,
        { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: DEFAULT_MAX_BUFFER },
        (error, stdout) => {
          const err = error as NodeJS.ErrnoException | null;
          if (err && (err.code === "ENOENT" || err.code === "EACCES")) {
            resolve(null);
            return;
          }
          const code =
            err && typeof err.code === "number" ? err.code : err ? 1 : 0;
          resolve({ stdout: stdout?.toString() ?? "", code });
        },
      );
    });
}

async function defaultReadFile(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/** Fill in any missing dependency with the default read-only implementation. */
export function resolveHostReadDeps(deps: Partial<HostReadDeps> = {}): HostReadDeps {
  return {
    run: deps.run ?? defaultCommandRunner(),
    readFile: deps.readFile ?? defaultReadFile,
    fileExists: deps.fileExists ?? defaultFileExists,
  };
}
