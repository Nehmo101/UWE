/**
 * Opt-in log-retention sweep for UWE's append-only tables.
 *
 * SAFETY: This module DELETES rows. It is therefore OFF by default. Nothing is
 * ever deleted unless retention is explicitly enabled — either via the option
 * `enabled: true` or the env flag `UWE_LOG_RETENTION_ENABLED === "true"`.
 * When disabled the sweep is a pure no-op (it does not even open the database);
 * a caller may pass `dryRun: true` to get a report of what WOULD be deleted
 * without deleting anything.
 *
 * Retention is conservative and age-based (generous defaults). Versioned tables
 * (page/image-studio versions) use keep-N-most-recent-per-parent so a stable
 * record never loses its whole history. AI runs are excluded by default because
 * deleting a run cascades into AI proposals / apply logs (application data); they
 * are only swept when explicitly opted in on top of the general enable flag.
 */
import {
  createPrismaClient,
  disconnectPrismaClientIfOwned,
  type PrismaClient,
} from "../client";

export const RETENTION_ENABLED_ENV = "UWE_LOG_RETENTION_ENABLED";
export const RETENTION_DAYS_ENV = "UWE_LOG_RETENTION_DAYS";
export const RETENTION_VERSION_KEEP_ENV = "UWE_VERSION_RETENTION_KEEP";
export const RETENTION_MIN_INTERVAL_ENV = "UWE_LOG_RETENTION_MIN_INTERVAL_MS";
export const RETENTION_INCLUDE_AI_RUNS_ENV = "UWE_LOG_RETENTION_INCLUDE_AI_RUNS";

/** Generous defaults — retention is opt-in, so err on the side of keeping data. */
export const DEFAULT_LOG_RETENTION_DAYS = 90;
export const DEFAULT_AI_RUN_RETENTION_DAYS = 180;
export const DEFAULT_VERSION_RETENTION_KEEP = 50;
/** A real sweep runs at most this often from the polled maintenance route. */
export const DEFAULT_RETENTION_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionMode = "disabled" | "throttled" | "dry-run" | "delete";

export interface RetentionTableResult {
  table: string;
  /** Rows actually deleted (0 in dry-run / disabled). */
  deleted: number;
  /** Rows matching the retention window (what a delete would remove). */
  wouldDelete: number;
}

export interface RetentionTableError {
  table: string;
  message: string;
}

export interface RetentionSummary {
  mode: RetentionMode;
  enabled: boolean;
  dryRun: boolean;
  retentionDays: number;
  keepVersions: number;
  includeAiRuns: boolean;
  startedAt: string;
  finishedAt: string;
  totalDeleted: number;
  tables: RetentionTableResult[];
  errors: RetentionTableError[];
}

export interface RetentionOptions {
  /** Explicit enable. Falls back to `UWE_LOG_RETENTION_ENABLED === "true"`. */
  enabled?: boolean;
  /** Report only, delete nothing. Overrides `enabled` for the delete step. */
  dryRun?: boolean;
  /** Base max age (days) for standard log tables. */
  retentionDays?: number;
  /** Keep the N most-recent versions per parent for versioned tables. */
  keepVersions?: number;
  /** Also prune old AI runs (cascades into proposals/apply logs). Opt-in. */
  pruneAiRuns?: boolean;
  /** Per-table day overrides, keyed by the table name in the summary. */
  overrides?: Partial<Record<string, number>>;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

interface AgeTable {
  name: string;
  defaultDays: number;
  count(cutoff: Date): Promise<number>;
  remove(cutoff: Date): Promise<number>;
}

interface VersionTable {
  name: string;
  process(keep: number, mode: "count" | "delete"): Promise<number>;
}

function readEnvEnabled(): boolean {
  return process.env[RETENTION_ENABLED_ENV] === "true";
}

function readEnvIncludeAiRuns(): boolean {
  return process.env[RETENTION_INCLUDE_AI_RUNS_ENV] === "true";
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.floor(parsed);
}

function resolveRetentionDays(option: number | undefined): number {
  const value = option ?? parsePositiveInt(process.env[RETENTION_DAYS_ENV]) ?? DEFAULT_LOG_RETENTION_DAYS;
  return Math.max(1, Math.floor(value));
}

function resolveVersionKeep(option: number | undefined): number {
  const value =
    option ?? parsePositiveInt(process.env[RETENTION_VERSION_KEEP_ENV]) ?? DEFAULT_VERSION_RETENTION_KEEP;
  return Math.max(1, Math.floor(value));
}

/** Standard append-only log tables — leaf rows, safe to delete purely by age. */
function buildAgeTables(prisma: PrismaClient, retentionDays: number): AgeTable[] {
  return [
    {
      name: "audit_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.auditLog.count({ where: { timestamp: { lt: c } } }),
      remove: (c) => prisma.auditLog.deleteMany({ where: { timestamp: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "activity_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.activityLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) => prisma.activityLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "share_access_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.shareAccessLog.count({ where: { accessedAt: { lt: c } } }),
      remove: (c) =>
        prisma.shareAccessLog.deleteMany({ where: { accessedAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "job_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.jobLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) => prisma.jobLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "mail_message_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.mailMessageLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) =>
        prisma.mailMessageLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "mail_audit_log",
      defaultDays: retentionDays,
      count: (c) => prisma.mailAuditLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) =>
        prisma.mailAuditLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "api_token_usage_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.apiTokenUsageLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) =>
        prisma.apiTokenUsageLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "ai_usage_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.aiUsageLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) => prisma.aiUsageLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "ai_apply_logs",
      defaultDays: retentionDays,
      count: (c) => prisma.aiApplyLog.count({ where: { createdAt: { lt: c } } }),
      remove: (c) => prisma.aiApplyLog.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
    {
      name: "webhook_deliveries",
      defaultDays: retentionDays,
      count: (c) => prisma.webhookDelivery.count({ where: { createdAt: { lt: c } } }),
      remove: (c) =>
        prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: c } } }).then((r) => r.count),
    },
  ];
}

/**
 * AI runs cascade-delete their proposals and apply logs, so pruning them touches
 * application data. Opt-in only, and even then restricted to terminal runs so an
 * in-flight generation is never removed.
 */
function buildAiRunTable(prisma: PrismaClient): AgeTable {
  return {
    name: "ai_runs",
    defaultDays: DEFAULT_AI_RUN_RETENTION_DAYS,
    count: (c) =>
      prisma.aiRun.count({
        where: {
          createdAt: { lt: c },
          status: { in: ["completed", "failed", "cancelled", "applied", "discarded"] },
        },
      }),
    remove: (c) =>
      prisma.aiRun
        .deleteMany({
          where: {
            createdAt: { lt: c },
            status: { in: ["completed", "failed", "cancelled", "applied", "discarded"] },
          },
        })
        .then((r) => r.count),
  };
}

async function prunePageVersions(
  prisma: PrismaClient,
  keep: number,
  mode: "count" | "delete",
): Promise<number> {
  const safeKeep = Math.max(1, Math.floor(keep));
  const groups = await prisma.pageVersion.groupBy({ by: ["pageId"], _count: { _all: true } });
  let affected = 0;

  for (const group of groups) {
    if (group._count._all <= safeKeep) {
      continue;
    }
    const boundary = await prisma.pageVersion.findMany({
      where: { pageId: group.pageId },
      orderBy: { version: "desc" },
      skip: safeKeep - 1,
      take: 1,
      select: { version: true },
    });
    const boundaryVersion = boundary[0]?.version;
    if (boundaryVersion === undefined) {
      continue;
    }
    const where = { pageId: group.pageId, version: { lt: boundaryVersion } };
    if (mode === "delete") {
      affected += (await prisma.pageVersion.deleteMany({ where })).count;
    } else {
      affected += await prisma.pageVersion.count({ where });
    }
  }

  return affected;
}

async function pruneImageStudioVersions(
  prisma: PrismaClient,
  keep: number,
  mode: "count" | "delete",
): Promise<number> {
  const safeKeep = Math.max(1, Math.floor(keep));
  const groups = await prisma.imageStudioVersion.groupBy({
    by: ["projectId"],
    _count: { _all: true },
  });
  let affected = 0;

  for (const group of groups) {
    if (group._count._all <= safeKeep) {
      continue;
    }
    const boundary = await prisma.imageStudioVersion.findMany({
      where: { projectId: group.projectId },
      orderBy: { versionNumber: "desc" },
      skip: safeKeep - 1,
      take: 1,
      select: { versionNumber: true },
    });
    const boundaryVersion = boundary[0]?.versionNumber;
    if (boundaryVersion === undefined) {
      continue;
    }
    const where = { projectId: group.projectId, versionNumber: { lt: boundaryVersion } };
    if (mode === "delete") {
      affected += (await prisma.imageStudioVersion.deleteMany({ where })).count;
    } else {
      affected += await prisma.imageStudioVersion.count({ where });
    }
  }

  return affected;
}

function buildVersionTables(prisma: PrismaClient): VersionTable[] {
  return [
    { name: "page_versions", process: (keep, mode) => prunePageVersions(prisma, keep, mode) },
    {
      name: "image_studio_versions",
      process: (keep, mode) => pruneImageStudioVersions(prisma, keep, mode),
    },
  ];
}

function resolveMode(enabled: boolean, dryRun: boolean): RetentionMode {
  if (dryRun) {
    return "dry-run";
  }
  return enabled ? "delete" : "disabled";
}

function inertSummary(
  mode: Extract<RetentionMode, "disabled" | "throttled">,
  enabled: boolean,
  dryRun: boolean,
  retentionDays: number,
  keepVersions: number,
  includeAiRuns: boolean,
  startedAt: Date,
): RetentionSummary {
  const iso = startedAt.toISOString();
  return {
    mode,
    enabled,
    dryRun,
    retentionDays,
    keepVersions,
    includeAiRuns,
    startedAt: iso,
    finishedAt: new Date().toISOString(),
    totalDeleted: 0,
    tables: [],
    errors: [],
  };
}

/**
 * Prune append-only log tables. Deletes nothing unless retention is enabled and
 * not in dry-run. A per-table failure is collected in `errors` and never aborts
 * the remaining tables. Returns a summary of rows deleted (or would-delete).
 */
export async function pruneRetentionLogs(
  prisma: PrismaClient,
  options?: RetentionOptions,
): Promise<RetentionSummary> {
  const startedAt = options?.now ?? new Date();
  const enabled = options?.enabled ?? readEnvEnabled();
  const dryRun = options?.dryRun ?? false;
  const retentionDays = resolveRetentionDays(options?.retentionDays);
  const keepVersions = resolveVersionKeep(options?.keepVersions);
  const includeAiRuns = options?.pruneAiRuns ?? readEnvIncludeAiRuns();
  const mode = resolveMode(enabled, dryRun);

  if (mode === "disabled") {
    return inertSummary("disabled", enabled, dryRun, retentionDays, keepVersions, includeAiRuns, startedAt);
  }

  const shouldDelete = mode === "delete";
  const now = startedAt.getTime();
  const overrides = options?.overrides ?? {};
  const tables: RetentionTableResult[] = [];
  const errors: RetentionTableError[] = [];

  const ageTables = buildAgeTables(prisma, retentionDays);
  if (includeAiRuns) {
    ageTables.push(buildAiRunTable(prisma));
  }

  for (const table of ageTables) {
    try {
      const days = Math.max(1, Math.floor(overrides[table.name] ?? table.defaultDays));
      const cutoff = new Date(now - days * DAY_MS);
      const matched = shouldDelete ? await table.remove(cutoff) : await table.count(cutoff);
      tables.push({ table: table.name, deleted: shouldDelete ? matched : 0, wouldDelete: matched });
    } catch (error) {
      errors.push({ table: table.name, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const table of buildVersionTables(prisma)) {
    try {
      const matched = await table.process(keepVersions, shouldDelete ? "delete" : "count");
      tables.push({ table: table.name, deleted: shouldDelete ? matched : 0, wouldDelete: matched });
    } catch (error) {
      errors.push({ table: table.name, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const totalDeleted = tables.reduce((sum, entry) => sum + entry.deleted, 0);

  return {
    mode,
    enabled,
    dryRun,
    retentionDays,
    keepVersions,
    includeAiRuns,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    totalDeleted,
    tables,
    errors,
  };
}

export interface LogRetentionSweepOptions {
  /** Reuse a client instead of opening/closing one. */
  prisma?: PrismaClient;
  enabled?: boolean;
  dryRun?: boolean;
  /** Minimum spacing between real sweeps (ms). 0 disables throttling. */
  minIntervalMs?: number;
  /** Bypass the throttle (e.g. an explicit manual run). */
  force?: boolean;
}

let lastSweepAt = 0;

function readEnvMinInterval(): number {
  const parsed = parsePositiveInt(process.env[RETENTION_MIN_INTERVAL_ENV]);
  return parsed ?? DEFAULT_RETENTION_MIN_INTERVAL_MS;
}

/**
 * Route-friendly entry point: resolves the opt-in gate from env, throttles real
 * sweeps, and manages its own database connection. When retention is disabled
 * (the default) this returns immediately WITHOUT opening the database, so it is
 * safe to call on a hot/polled request path.
 */
export async function runLogRetentionSweep(
  options?: LogRetentionSweepOptions,
): Promise<RetentionSummary> {
  const enabled = options?.enabled ?? readEnvEnabled();
  const dryRun = options?.dryRun ?? false;
  const startedAt = new Date();
  const retentionDays = resolveRetentionDays(undefined);
  const keepVersions = resolveVersionKeep(undefined);
  const includeAiRuns = readEnvIncludeAiRuns();

  if (!enabled && !dryRun) {
    return inertSummary("disabled", enabled, dryRun, retentionDays, keepVersions, includeAiRuns, startedAt);
  }

  const minInterval = options?.minIntervalMs ?? readEnvMinInterval();
  const now = Date.now();
  if (!options?.force && minInterval > 0 && lastSweepAt > 0 && now - lastSweepAt < minInterval) {
    return inertSummary("throttled", enabled, dryRun, retentionDays, keepVersions, includeAiRuns, startedAt);
  }
  lastSweepAt = now;

  const prisma = options?.prisma ?? createPrismaClient();
  const ownsConnection = !options?.prisma;
  try {
    return await pruneRetentionLogs(prisma, { enabled, dryRun });
  } finally {
    if (ownsConnection) {
      await disconnectPrismaClientIfOwned(prisma);
    }
  }
}
