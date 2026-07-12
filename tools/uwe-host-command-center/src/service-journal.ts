import { resolveHostReadDeps, type HostReadDeps } from "@uwe/host-monitor";

export interface JournalLine {
  timestamp: string | null;
  message: string;
}

export interface ServiceJournalSnapshot {
  unit: string;
  available: boolean;
  message: string;
  lines: JournalLine[];
}

const MAX_LINES = 20;

export function parseServiceJournal(stdout: string): JournalLine[] {
  const lines: JournalLine[] = [];
  for (const raw of stdout.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("-- ")) continue;
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace <= 0) {
      lines.push({ timestamp: null, message: trimmed });
      continue;
    }
    const maybeTimestamp = trimmed.slice(0, firstSpace);
    const isTimestamp = /^\d{4}-\d{2}-\d{2}T/.test(maybeTimestamp);
    lines.push({
      timestamp: isTimestamp ? maybeTimestamp : null,
      message: isTimestamp ? trimmed.slice(firstSpace + 1) : trimmed,
    });
  }
  return lines.slice(-MAX_LINES).reverse();
}

export async function collectServiceJournal(
  unit = "uwe.service",
  deps: Partial<HostReadDeps> = {},
): Promise<ServiceJournalSnapshot> {
  const { run } = resolveHostReadDeps(deps);
  const result = await run("journalctl", [
    "-u",
    unit,
    "-n",
    String(MAX_LINES),
    "--no-pager",
    "-o",
    "short-iso",
    "-q",
  ]);
  if (result == null || result.code !== 0) {
    return {
      unit,
      available: false,
      message: "journalctl nicht verfügbar",
      lines: [],
    };
  }
  const lines = parseServiceJournal(result.stdout);
  return {
    unit,
    available: true,
    message: lines.length ? `${lines.length} Zeilen` : "Keine Einträge",
    lines,
  };
}
