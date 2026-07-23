import type { PrismaClient } from "./client";

export type AiUsageRollupPeriod = "current_month" | "last_30_days" | "current_year";

export interface AiUsageFeatureRollup {
  feature: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageUserRollup {
  userId: string | null;
  userDisplayName: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageRollupSummary {
  period: AiUsageRollupPeriod;
  periodLabel: string;
  since: Date;
  until: Date;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  byFeature: AiUsageFeatureRollup[];
  byUser: AiUsageUserRollup[];
}

const MS_PER_DAY = 86_400_000;

// Usage-rollup periods are keyed by calendar month/year and must be deterministic
// regardless of the server timezone, so all bounds are computed in UTC.
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfYear(date: Date): Date {
  const d = new Date(date);
  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export function resolveAiUsagePeriodBounds(
  period: AiUsageRollupPeriod,
  now: Date = new Date(),
): { since: Date; until: Date; periodLabel: string } {
  switch (period) {
    case "current_month": {
      const since = startOfMonth(now);
      const until = addMonths(since, 1);
      const month = String(since.getUTCMonth() + 1).padStart(2, "0");
      return { since, until, periodLabel: `${since.getUTCFullYear()}-${month}` };
    }
    case "last_30_days": {
      const until = startOfDay(now);
      until.setUTCHours(23, 59, 59, 999);
      const since = new Date(until.getTime() - 30 * MS_PER_DAY);
      since.setUTCHours(0, 0, 0, 0);
      return { since, until: now, periodLabel: "Letzte 30 Tage" };
    }
    case "current_year": {
      const since = startOfYear(now);
      const until = addYears(since, 1);
      return { since, until, periodLabel: String(since.getUTCFullYear()) };
    }
    default: {
      const exhaustive: never = period;
      throw new Error(`Unknown AI usage period: ${exhaustive}`);
    }
  }
}

export function formatUsdAmount(amountUsd: number): string {
  return `$${amountUsd.toFixed(4)}`;
}

export function resolveUsdToEuroRate(): number {
  const raw = process.env.AI_USD_TO_EUR_RATE?.trim();
  if (!raw) return 0.92;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.92;
}

export function usdToEuroCents(amountUsd: number, rate = resolveUsdToEuroRate()): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  return Math.round(amountUsd * rate * 100);
}

export function buildAiUsageContractName(periodKey: string): string {
  return `KI-Nutzung (${periodKey})`;
}

export class AiUsageRollupService {
  constructor(private readonly db: PrismaClient) {}

  async getRollupSummary(options: {
    period?: AiUsageRollupPeriod;
    since?: Date;
    until?: Date;
    userId?: string;
    feature?: string;
  } = {}): Promise<AiUsageRollupSummary> {
    const period = options.period ?? "current_month";
    const bounds =
      options.since && options.until
        ? { since: options.since, until: options.until, periodLabel: "Benutzerdefiniert" }
        : resolveAiUsagePeriodBounds(period);

    const where = {
      createdAt: { gte: bounds.since, lt: bounds.until },
      success: true,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.feature ? { feature: options.feature } : {}),
    };

    const [totals, byFeatureRows, byUserRows, users] = await Promise.all([
      this.db.aiUsageLog.aggregate({
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
      this.db.aiUsageLog.groupBy({
        by: ["feature"],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        orderBy: { feature: "asc" },
      }),
      this.db.aiUsageLog.groupBy({
        by: ["userId"],
        where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      }),
      this.db.user.findMany({ select: { id: true, displayName: true } }),
    ]);

    const userNameById = new Map(users.map((user) => [user.id, user.displayName]));

    const byFeature = byFeatureRows
      .map((row) => ({
        feature: row.feature,
        requestCount: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        estimatedCostUsd: row._sum.estimatedCostUsd ?? 0,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || a.feature.localeCompare(b.feature));

    const byUser = byUserRows
      .map((row) => ({
        userId: row.userId,
        userDisplayName: row.userId ? (userNameById.get(row.userId) ?? null) : "System",
        requestCount: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        estimatedCostUsd: row._sum.estimatedCostUsd ?? 0,
      }))
      .sort(
        (a, b) =>
          b.estimatedCostUsd - a.estimatedCostUsd ||
          String(a.userDisplayName ?? "").localeCompare(String(b.userDisplayName ?? "")),
      );

    return {
      period,
      periodLabel: bounds.periodLabel,
      since: bounds.since,
      until: bounds.until,
      requestCount: totals._count._all,
      inputTokens: totals._sum.inputTokens ?? 0,
      outputTokens: totals._sum.outputTokens ?? 0,
      estimatedCostUsd: totals._sum.estimatedCostUsd ?? 0,
      byFeature,
      byUser,
    };
  }
}

export function createAiUsageRollupService(db: PrismaClient): AiUsageRollupService {
  return new AiUsageRollupService(db);
}
