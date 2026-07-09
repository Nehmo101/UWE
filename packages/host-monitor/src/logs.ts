import { resolveHostReadDeps, type HostReadDeps } from "./runner";
import type {
  FailedLogin,
  FailedLoginsResult,
  RecentErrorsResult,
  RecentLogEntry,
} from "./types";

/**
 * Recent host errors and failed login attempts. Both sources (journald, btmp)
 * usually require the systemd-journal/adm group or root; when unavailable the
 * panels degrade to `available: false` rather than failing. Read-only.
 */

const MAX_ERRORS = 15;
const MAX_FAILED_LOGINS = 10;

/** Parse `journalctl -o short-iso` lines into timestamp + message. */
export function parseJournalErrors(stdout: string): RecentLogEntry[] {
  const entries: RecentLogEntry[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("-- ")) continue;
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace <= 0) {
      entries.push({ timestamp: null, message: trimmed });
      continue;
    }
    const maybeTimestamp = trimmed.slice(0, firstSpace);
    const isTimestamp = /^\d{4}-\d{2}-\d{2}T/.test(maybeTimestamp);
    entries.push({
      timestamp: isTimestamp ? maybeTimestamp : null,
      message: isTimestamp ? trimmed.slice(firstSpace + 1) : trimmed,
    });
  }
  return entries.slice(-MAX_ERRORS).reverse();
}

export async function collectRecentErrors(
  deps: Partial<HostReadDeps> = {},
): Promise<RecentErrorsResult> {
  const { run } = resolveHostReadDeps(deps);
  const result = await run("journalctl", [
    "-p",
    "err",
    "-n",
    String(MAX_ERRORS),
    "--no-pager",
    "-o",
    "short-iso",
    "-q",
  ]);
  if (result == null || result.code !== 0) {
    return { available: false, entries: [], message: "journalctl nicht verfügbar" };
  }
  const entries = parseJournalErrors(result.stdout);
  return {
    available: true,
    entries,
    message: entries.length === 0 ? "Keine Fehler im Journal" : `${entries.length} Fehler (Auszug)`,
  };
}

/** Parse `lastb` output into failed-login records (footer lines dropped). */
export function parseLastb(stdout: string): FailedLogin[] {
  const logins: FailedLogin[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(btmp begins|wtmp begins)/i.test(trimmed)) continue;
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 3) continue;
    logins.push({
      user: tokens[0] ?? null,
      from: tokens[2] ?? null,
      when: tokens.slice(3).join(" ") || null,
    });
  }
  return logins.slice(0, MAX_FAILED_LOGINS);
}

/** Parse sshd "Failed password" journal lines as a privileged-free fallback. */
export function parseSshFailures(stdout: string): FailedLogin[] {
  const logins: FailedLogin[] = [];
  for (const line of stdout.split("\n")) {
    const match = /Failed password for (?:invalid user )?(\S+) from (\S+)/.exec(line);
    if (!match) continue;
    const firstSpace = line.trim().indexOf(" ");
    const maybeTimestamp = firstSpace > 0 ? line.trim().slice(0, firstSpace) : null;
    logins.push({
      user: match[1],
      from: match[2],
      when: maybeTimestamp && /^\d{4}-\d{2}-\d{2}T/.test(maybeTimestamp) ? maybeTimestamp : null,
    });
  }
  return logins.slice(-MAX_FAILED_LOGINS).reverse();
}

export async function collectFailedLogins(
  deps: Partial<HostReadDeps> = {},
): Promise<FailedLoginsResult> {
  const { run } = resolveHostReadDeps(deps);

  const lastb = await run("lastb", ["-n", String(MAX_FAILED_LOGINS), "-w"]);
  if (lastb != null && lastb.code === 0) {
    const recent = parseLastb(lastb.stdout);
    return {
      available: true,
      recent,
      message: recent.length === 0 ? "Keine fehlgeschlagenen Anmeldungen" : `${recent.length} Versuche (Auszug)`,
    };
  }

  // Fallback: sshd failures from the journal.
  const journal = await run("journalctl", [
    "-n",
    "200",
    "--no-pager",
    "-o",
    "short-iso",
    "-q",
    "-g",
    "Failed password",
  ]);
  if (journal != null && journal.code === 0) {
    const recent = parseSshFailures(journal.stdout);
    return {
      available: true,
      recent,
      message: recent.length === 0 ? "Keine fehlgeschlagenen Anmeldungen" : `${recent.length} SSH-Versuche (Auszug)`,
    };
  }

  return { available: false, recent: [], message: "lastb/journalctl nicht verfügbar" };
}
