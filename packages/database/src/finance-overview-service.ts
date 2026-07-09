import type {
  ContractBillingInterval,
  ContractExpense,
  ContractExpenseType,
  ContractStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import {
  BILLING_INTERVAL_LABELS,
  buildContractAlerts,
  formatEuroFromCents,
  normalizeToMonthlyCents,
  normalizeToYearlyCents,
  summarizeContractCosts,
  type ContractAlert,
} from "./contract-expense-utils";

/** German labels for the fixed ContractExpenseType enum (used for byCategory grouping). */
export const EXPENSE_TYPE_LABELS: Record<ContractExpenseType, string> = {
  subscription: "Abo",
  rent: "Miete",
  insurance: "Versicherung",
  utility: "Nebenkosten",
  software: "Software",
  other: "Sonstiges",
};

/** Statuses that count as "laufend" and carry recurring cost. */
export const FINANCE_ACTIVE_STATUSES: ContractStatus[] = ["active", "review"];

/** Default number of most expensive contracts surfaced as review candidates. */
const DEFAULT_REVIEW_TOP_N = 3;

/** Compact, UI-ready view of a single contract with normalized costs. */
export interface FinanceContractView {
  id: string;
  name: string;
  vendor: string;
  status: ContractStatus;
  expenseType: ContractExpenseType;
  categoryLabel: string;
  billingInterval: ContractBillingInterval;
  billingIntervalLabel: string;
  amountCents: number;
  monthlyCents: number;
  yearlyCents: number;
  monthlyLabel: string;
  yearlyLabel: string;
  cancelByDate: Date | null;
  renewalDate: Date | null;
  nextPaymentDate: Date | null;
  portalUrl: string | null;
  isAiUsage: boolean;
}

export interface FinanceTotals {
  monthlyTotalCents: number;
  yearlyTotalCents: number;
  activeCount: number;
  monthlyLabel: string;
  yearlyLabel: string;
}

export interface FinanceGroupBucket {
  key: string;
  label: string;
  count: number;
  monthlyCents: number;
  yearlyCents: number;
  monthlyLabel: string;
  yearlyLabel: string;
}

export interface FinanceAlertView extends ContractAlert {
  dueDateLabel: string | null;
}

export interface FinanceReviewCandidate {
  id: string;
  name: string;
  vendor: string;
  reason: "review" | "high_cost";
  reasonLabel: string;
  status: ContractStatus;
  monthlyCents: number;
  yearlyCents: number;
  monthlyLabel: string;
  yearlyLabel: string;
  portalUrl: string | null;
}

export interface FinanceAiCosts {
  monthlyCents: number;
  yearlyCents: number;
  monthlyLabel: string;
  yearlyLabel: string;
  itemCount: number;
  items: FinanceContractView[];
}

export interface FinanceOverview {
  activeContracts: FinanceContractView[];
  totals: FinanceTotals;
  alerts: FinanceAlertView[];
  byCategory: FinanceGroupBucket[];
  byInterval: FinanceGroupBucket[];
  aiCosts: FinanceAiCosts;
  reviewCandidates: FinanceReviewCandidate[];
  generatedAt: Date;
  period: FinancePeriod;
}

export type FinancePeriod = "all" | "month" | "quarter" | "year";

export function resolveFinancePeriodBounds(
  period: FinancePeriod,
  now: Date = new Date(),
): { start: Date; end: Date } | null {
  if (period === "all") return null;

  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "year") {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterStartMonth, 1),
      end: new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function formatDateLabel(date: Date | null): string | null {
  if (!date) {
    return null;
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Pure: map a raw ContractExpense to the compact, formatted UI view. */
export function toFinanceContractView(contract: ContractExpense): FinanceContractView {
  const amountCents = contract.amountCents ?? 0;
  const monthlyCents = normalizeToMonthlyCents(amountCents, contract.billingInterval);
  const yearlyCents = normalizeToYearlyCents(amountCents, contract.billingInterval);
  return {
    id: contract.id,
    name: contract.name,
    vendor: contract.vendor,
    status: contract.status,
    expenseType: contract.expenseType,
    categoryLabel: contract.categoryLabel,
    billingInterval: contract.billingInterval,
    billingIntervalLabel: BILLING_INTERVAL_LABELS[contract.billingInterval],
    amountCents,
    monthlyCents,
    yearlyCents,
    monthlyLabel: formatEuroFromCents(monthlyCents),
    yearlyLabel: formatEuroFromCents(yearlyCents),
    cancelByDate: contract.cancelByDate,
    renewalDate: contract.renewalDate,
    nextPaymentDate: contract.nextPaymentDate,
    portalUrl: contract.portalUrl,
    isAiUsage: contract.source === "ai_usage",
  };
}

function makeBucket(key: string, label: string): FinanceGroupBucket {
  return {
    key,
    label,
    count: 0,
    monthlyCents: 0,
    yearlyCents: 0,
    monthlyLabel: formatEuroFromCents(0),
    yearlyLabel: formatEuroFromCents(0),
  };
}

function finalizeBuckets(buckets: Map<string, FinanceGroupBucket>): FinanceGroupBucket[] {
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      monthlyLabel: formatEuroFromCents(bucket.monthlyCents),
      yearlyLabel: formatEuroFromCents(bucket.yearlyCents),
    }))
    .sort((a, b) => b.yearlyCents - a.yearlyCents);
}

/** Pure: group contracts by expenseType (with a free-text categoryLabel fallback for empty buckets). */
export function groupByCategory(contracts: ContractExpense[]): FinanceGroupBucket[] {
  const buckets = new Map<string, FinanceGroupBucket>();
  for (const contract of contracts) {
    const key = contract.expenseType;
    const trimmedLabel = contract.categoryLabel.trim();
    const label = trimmedLabel.length > 0 ? trimmedLabel : EXPENSE_TYPE_LABELS[contract.expenseType];
    const bucket = buckets.get(key) ?? makeBucket(key, label);
    bucket.count += 1;
    bucket.monthlyCents += normalizeToMonthlyCents(contract.amountCents, contract.billingInterval);
    bucket.yearlyCents += normalizeToYearlyCents(contract.amountCents, contract.billingInterval);
    buckets.set(key, bucket);
  }
  return finalizeBuckets(buckets);
}

/** Pure: group contracts by billing interval. */
export function groupByInterval(contracts: ContractExpense[]): FinanceGroupBucket[] {
  const buckets = new Map<string, FinanceGroupBucket>();
  for (const contract of contracts) {
    const key = contract.billingInterval;
    const bucket = buckets.get(key) ?? makeBucket(key, BILLING_INTERVAL_LABELS[contract.billingInterval]);
    bucket.count += 1;
    bucket.monthlyCents += normalizeToMonthlyCents(contract.amountCents, contract.billingInterval);
    bucket.yearlyCents += normalizeToYearlyCents(contract.amountCents, contract.billingInterval);
    buckets.set(key, bucket);
  }
  return finalizeBuckets(buckets);
}

/**
 * Pure heuristic for "lohnt sich noch?": every contract flagged `review`, plus the most
 * expensive `topN` contracts by yearly cost. Sorted by yearly cost descending, deduplicated.
 */
export function rankReviewCandidates(
  contracts: ContractExpense[],
  topN = DEFAULT_REVIEW_TOP_N,
): FinanceReviewCandidate[] {
  const flaggedIds = new Set(
    contracts.filter((contract) => contract.status === "review").map((contract) => contract.id),
  );
  const byYearly = [...contracts]
    .filter((contract) => (contract.amountCents ?? 0) > 0)
    .sort(
      (a, b) =>
        normalizeToYearlyCents(b.amountCents, b.billingInterval) -
        normalizeToYearlyCents(a.amountCents, a.billingInterval),
    );
  const highCostIds = new Set(byYearly.slice(0, Math.max(0, topN)).map((contract) => contract.id));

  const selected = contracts.filter(
    (contract) => flaggedIds.has(contract.id) || highCostIds.has(contract.id),
  );

  return selected
    .map((contract) => {
      const monthlyCents = normalizeToMonthlyCents(contract.amountCents, contract.billingInterval);
      const yearlyCents = normalizeToYearlyCents(contract.amountCents, contract.billingInterval);
      const reason: FinanceReviewCandidate["reason"] = flaggedIds.has(contract.id)
        ? "review"
        : "high_cost";
      return {
        id: contract.id,
        name: contract.name,
        vendor: contract.vendor,
        reason,
        reasonLabel: reason === "review" ? "Zur Prüfung markiert" : "Hohe Jahreskosten",
        status: contract.status,
        monthlyCents,
        yearlyCents,
        monthlyLabel: formatEuroFromCents(monthlyCents),
        yearlyLabel: formatEuroFromCents(yearlyCents),
        portalUrl: contract.portalUrl,
      };
    })
    .sort((a, b) => b.yearlyCents - a.yearlyCents);
}

export class FinanceOverviewService {
  constructor(private readonly db: PrismaClient) {}

  async getOverview(
    now: Date = new Date(),
    options?: { period?: FinancePeriod },
  ): Promise<FinanceOverview> {
    const period = options?.period ?? "all";
    const bounds = resolveFinancePeriodBounds(period, now);

    const contracts = await this.db.contractExpense.findMany({
      where: {
        status: { in: FINANCE_ACTIVE_STATUSES },
        ...(bounds
          ? {
              OR: [
                { nextPaymentDate: { gte: bounds.start, lte: bounds.end } },
                { renewalDate: { gte: bounds.start, lte: bounds.end } },
                { cancelByDate: { gte: bounds.start, lte: bounds.end } },
                { updatedAt: { gte: bounds.start, lte: bounds.end } },
              ],
            }
          : {}),
      },
      orderBy: [{ renewalDate: "asc" }, { updatedAt: "desc" }],
    });

    const summary = summarizeContractCosts(contracts);
    const activeContracts = contracts.map(toFinanceContractView);
    const alerts: FinanceAlertView[] = buildContractAlerts(contracts, now).map((alert) => ({
      ...alert,
      dueDateLabel: formatDateLabel(alert.dueDate),
    }));

    const aiItems = activeContracts.filter((contract) => contract.isAiUsage);
    const aiMonthlyCents = aiItems.reduce((sum, item) => sum + item.monthlyCents, 0);
    const aiYearlyCents = aiItems.reduce((sum, item) => sum + item.yearlyCents, 0);

    return {
      activeContracts,
      totals: {
        monthlyTotalCents: summary.monthlyTotalCents,
        yearlyTotalCents: summary.yearlyTotalCents,
        activeCount: summary.activeCount,
        monthlyLabel: formatEuroFromCents(summary.monthlyTotalCents),
        yearlyLabel: formatEuroFromCents(summary.yearlyTotalCents),
      },
      alerts,
      byCategory: groupByCategory(contracts),
      byInterval: groupByInterval(contracts),
      aiCosts: {
        monthlyCents: aiMonthlyCents,
        yearlyCents: aiYearlyCents,
        monthlyLabel: formatEuroFromCents(aiMonthlyCents),
        yearlyLabel: formatEuroFromCents(aiYearlyCents),
        itemCount: aiItems.length,
        items: aiItems,
      },
      reviewCandidates: rankReviewCandidates(contracts),
      generatedAt: now,
      period,
    };
  }
}

export function createFinanceOverviewService(db: PrismaClient): FinanceOverviewService {
  return new FinanceOverviewService(db);
}
