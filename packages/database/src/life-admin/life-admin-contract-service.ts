import type {
  ContractExpenseSource,
  ContractStatus,
} from "../generated/prisma/client";
import type { PrismaClient } from "../client";
import {
  buildAiUsageContractName,
  createAiUsageRollupService,
  resolveAiUsagePeriodBounds,
  usdToEuroCents,
  type AiUsageRollupPeriod,
  type AiUsageRollupSummary,
} from "../ai-usage-rollup-service";
import { toPrismaJsonValue } from "../json-utils";
import type { CreateContractExpenseInput } from "./life-admin-types";

export class LifeAdminContractService {
  constructor(private readonly db: PrismaClient) {}

  async listContractExpenses(options: {
    status?: ContractStatus | ContractStatus[];
    source?: ContractExpenseSource;
    limit?: number;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.contractExpense.findMany({
      where: {
        status: statusFilter,
        ...(options.source ? { source: options.source } : {}),
      },
      orderBy: [{ renewalDate: "asc" }, { updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async createContractExpense(input: CreateContractExpenseInput) {
    return this.db.contractExpense.create({
      data: {
        name: input.name,
        vendor: input.vendor ?? "",
        status: input.status ?? "active",
        expenseType: input.expenseType ?? "other",
        source: input.source ?? "manual",
        billingInterval: input.billingInterval ?? "monthly",
        categoryLabel: input.categoryLabel ?? "",
        amountCents: input.amountCents ?? undefined,
        currency: input.currency ?? "EUR",
        billingDay: input.billingDay ?? undefined,
        startDate: input.startDate ?? undefined,
        nextPaymentDate: input.nextPaymentDate ?? undefined,
        renewalDate: input.renewalDate ?? undefined,
        cancelByDate: input.cancelByDate ?? undefined,
        portalUrl: input.portalUrl ?? undefined,
        notes: input.notes ?? "",
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getContractExpense(id: string) {
    return this.db.contractExpense.findUnique({ where: { id } });
  }

  async updateContractExpense(id: string, input: Partial<CreateContractExpenseInput>) {
    return this.db.contractExpense.update({
      where: { id },
      data: {
        name: input.name,
        vendor: input.vendor,
        status: input.status,
        expenseType: input.expenseType,
        source: input.source,
        billingInterval: input.billingInterval,
        categoryLabel: input.categoryLabel,
        amountCents: input.amountCents ?? undefined,
        currency: input.currency,
        billingDay: input.billingDay ?? undefined,
        startDate: input.startDate ?? undefined,
        nextPaymentDate: input.nextPaymentDate ?? undefined,
        renewalDate: input.renewalDate ?? undefined,
        cancelByDate: input.cancelByDate ?? undefined,
        portalUrl: input.portalUrl ?? undefined,
        notes: input.notes,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deleteContractExpense(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "contract_expense", sourceId: id },
          { targetType: "contract_expense", targetId: id },
        ],
      },
    });
    return this.db.contractExpense.delete({ where: { id } });
  }

  async getAiUsageCostRollups(options: {
    period?: AiUsageRollupPeriod;
  } = {}): Promise<AiUsageRollupSummary> {
    return createAiUsageRollupService(this.db).getRollupSummary({
      period: options.period ?? "current_month",
    });
  }

  async syncAiUsageContractExpense(options: { period?: AiUsageRollupPeriod } = {}) {
    const period = options.period ?? "current_month";
    const bounds = resolveAiUsagePeriodBounds(period);
    const rollup = await createAiUsageRollupService(this.db).getRollupSummary({
      since: bounds.since,
      until: bounds.until,
    });
    const name = buildAiUsageContractName(bounds.periodLabel);
    const amountCents = usdToEuroCents(rollup.estimatedCostUsd);
    const metadata = {
      periodKey: bounds.periodLabel,
      period,
      requestCount: rollup.requestCount,
      inputTokens: rollup.inputTokens,
      outputTokens: rollup.outputTokens,
      estimatedCostUsd: rollup.estimatedCostUsd,
      syncedAt: new Date().toISOString(),
    };

    const existing = await this.db.contractExpense.findFirst({
      where: { source: "ai_usage", name },
    });

    if (existing) {
      return this.db.contractExpense.update({
        where: { id: existing.id },
        data: {
          amountCents,
          status: amountCents > 0 ? "active" : "archived",
          categoryLabel: "KI / Cloud",
          notes:
            "Automatisch aus ai_usage_logs übernommen (Schätzung, nur Cloud-Kosten). RTX-Läufe sind 0 USD.",
          metadata: toPrismaJsonValue(metadata),
        },
      });
    }

    return this.db.contractExpense.create({
      data: {
        name,
        vendor: "Cloud-KI (Schätzung)",
        status: amountCents > 0 ? "active" : "archived",
        expenseType: "software",
        source: "ai_usage",
        billingInterval: "monthly",
        categoryLabel: "KI / Cloud",
        amountCents,
        startDate: bounds.since,
        notes:
          "Automatisch aus ai_usage_logs übernommen (Schätzung, nur Cloud-Kosten). RTX-Läufe sind 0 USD.",
        metadata: toPrismaJsonValue(metadata),
      },
    });
  }
}
