/**
 * Bounded, privacy-safe record of recently finished jobs.
 *
 * Keeps at most `maxEntries` (default 50) of the most recent completed/failed
 * jobs so the desktop client can show recent activity. Only non-sensitive
 * descriptors are stored — job id, type, lane, status, duration, and a short
 * truncated failure reason. Job payloads and results are NEVER recorded.
 *
 * Persistence to `<dataDir>/job-history.json` is optional and best-effort: a
 * failed read/write never disrupts the work loop.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const JOB_HISTORY_FILENAME = "job-history.json";
export const DEFAULT_JOB_HISTORY_LIMIT = 50;
const REASON_MAX_LENGTH = 300;

export type JobHistoryStatus = "completed" | "failed";

export interface JobHistoryEntry {
  id: string;
  type: string;
  lane: string;
  status: JobHistoryStatus;
  durationMs: number;
  /** Present only for failed jobs; truncated and never includes payloads. */
  reason?: string;
  finishedAt: string;
}

export interface RecordJobInput {
  id: string;
  type: string;
  lane: string;
  status: JobHistoryStatus;
  durationMs: number;
  reason?: string;
}

export function jobHistoryPath(dataDir: string): string {
  return join(dataDir, JOB_HISTORY_FILENAME);
}

function sanitizeReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  const trimmed = reason.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, REASON_MAX_LENGTH);
}

function isValidEntry(value: unknown): value is JobHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.type === "string" &&
    typeof entry.lane === "string" &&
    (entry.status === "completed" || entry.status === "failed") &&
    typeof entry.durationMs === "number" &&
    typeof entry.finishedAt === "string"
  );
}

export interface JobHistoryOptions {
  maxEntries?: number;
  /** Absolute file path to persist to; omit for in-memory only. */
  persistPath?: string;
}

export class JobHistory {
  private readonly maxEntries: number;
  private readonly persistPath: string | undefined;
  private entries: JobHistoryEntry[] = [];

  constructor(options: JobHistoryOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_JOB_HISTORY_LIMIT);
    this.persistPath = options.persistPath;
    this.load();
  }

  private load(): void {
    if (!this.persistPath) return;
    try {
      const raw = JSON.parse(readFileSync(this.persistPath, "utf8")) as unknown;
      const list = Array.isArray(raw) ? raw : [];
      this.entries = list.filter(isValidEntry).slice(0, this.maxEntries);
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    if (!this.persistPath) return;
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      writeFileSync(this.persistPath, `${JSON.stringify(this.entries, null, 2)}\n`, "utf8");
    } catch {
      // Persisting history must never break the connector.
    }
  }

  /** Record a finished job at the front of the list, trimming to the limit. */
  record(input: RecordJobInput): JobHistoryEntry {
    const entry: JobHistoryEntry = {
      id: input.id,
      type: input.type,
      lane: input.lane,
      status: input.status,
      durationMs: Math.max(0, Math.round(input.durationMs)),
      finishedAt: new Date().toISOString(),
    };
    const reason = sanitizeReason(input.reason);
    if (reason) {
      entry.reason = reason;
    }

    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }
    this.persist();
    return entry;
  }

  /** Most-recent-first snapshot of the recorded jobs. */
  list(): JobHistoryEntry[] {
    return [...this.entries];
  }

  get size(): number {
    return this.entries.length;
  }
}
