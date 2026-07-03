import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ContractExpense } from "./generated/prisma/client";
import {
  createFinanceOverviewService,
  groupByInterval,
  rankReviewCandidates,
  toFinanceContractView,
} from "./finance-overview-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

function makeContract(overrides: Partial<ContractExpense>): ContractExpense {
  const now = new Date("2026-07-01T00:00:00.000Z");
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Vertrag",
    vendor: overrides.vendor ?? "",
    status: overrides.status ?? "active",
    expenseType: overrides.expenseType ?? "subscription",
    source: overrides.source ?? "manual",
    billingInterval: overrides.billingInterval ?? "monthly",
    categoryLabel: overrides.categoryLabel ?? "",
    amountCents: overrides.amountCents ?? 1000,
    currency: overrides.currency ?? "EUR",
    billingDay: overrides.billingDay ?? null,
    startDate: overrides.startDate ?? null,
    nextPaymentDate: overrides.nextPaymentDate ?? null,
    renewalDate: overrides.renewalDate ?? null,
    cancelByDate: overrides.cancelByDate ?? null,
    portalUrl: overrides.portalUrl ?? null,
    notes: overrides.notes ?? "",
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as ContractExpense;
}

describe("toFinanceContractView (pure)", () => {
  it("normalizes a yearly contract into monthly + yearly cents", () => {
    const view = toFinanceContractView(
      makeContract({ billingInterval: "yearly", amountCents: 12_000 }),
    );
    assert.equal(view.yearlyCents, 12_000);
    assert.equal(view.monthlyCents, 1_000);
    assert.equal(view.yearlyLabel, "120.00 €");
    assert.equal(view.isAiUsage, false);
  });

  it("flags ai_usage source contracts", () => {
    const view = toFinanceContractView(makeContract({ source: "ai_usage" }));
    assert.equal(view.isAiUsage, true);
  });
});

describe("rankReviewCandidates (pure)", () => {
  it("includes review-flagged and the most expensive contracts", () => {
    const contracts = [
      makeContract({ id: "cheap", amountCents: 500, billingInterval: "monthly" }),
      makeContract({ id: "expensive", amountCents: 5_000, billingInterval: "monthly" }),
      makeContract({ id: "flagged", amountCents: 100, status: "review" }),
    ];
    const result = rankReviewCandidates(contracts, 1);
    const ids = result.map((entry) => entry.id);
    assert.ok(ids.includes("flagged"));
    assert.ok(ids.includes("expensive"));
    assert.ok(!ids.includes("cheap"));
    const flagged = result.find((entry) => entry.id === "flagged");
    assert.equal(flagged?.reason, "review");
    // sorted by yearly cost desc
    assert.equal(result[0]?.id, "expensive");
  });

  it("ignores zero-cost contracts for the high-cost heuristic", () => {
    const result = rankReviewCandidates(
      [makeContract({ id: "free", amountCents: 0 })],
      3,
    );
    assert.equal(result.length, 0);
  });
});

describe("groupByInterval (pure)", () => {
  it("aggregates counts and costs per interval", () => {
    const buckets = groupByInterval([
      makeContract({ id: "a", billingInterval: "monthly", amountCents: 1_000 }),
      makeContract({ id: "b", billingInterval: "monthly", amountCents: 2_000 }),
      makeContract({ id: "c", billingInterval: "yearly", amountCents: 12_000 }),
    ]);
    const monthly = buckets.find((bucket) => bucket.key === "monthly");
    assert.equal(monthly?.count, 2);
    assert.equal(monthly?.monthlyCents, 3_000);
    assert.equal(monthly?.yearlyCents, 36_000);
  });
});

describe("finance overview (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("aggregates monthly/yearly totals and surfaces a cancel alert", async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);

    await db.contractExpense.create({
      data: {
        name: "Streaming",
        status: "active",
        billingInterval: "monthly",
        amountCents: 1_500,
        expenseType: "subscription",
        cancelByDate: soon,
      },
    });
    await db.contractExpense.create({
      data: {
        name: "Domain",
        status: "active",
        billingInterval: "yearly",
        amountCents: 12_000,
        expenseType: "software",
      },
    });

    const overview = await createFinanceOverviewService(db).getOverview();

    // monthly: 1500 (streaming) + 1000 (12000/12 domain) = 2500
    assert.equal(overview.totals.monthlyTotalCents, 2_500);
    // yearly: 18000 (streaming*12) + 12000 (domain) = 30000
    assert.equal(overview.totals.yearlyTotalCents, 30_000);
    assert.equal(overview.totals.activeCount, 2);
    assert.equal(overview.activeContracts.length, 2);

    const cancelAlert = overview.alerts.find((alert) => alert.kind === "cancel_soon");
    assert.ok(cancelAlert, "expected a cancel_soon alert for the streaming contract");
    assert.equal(cancelAlert?.name, "Streaming");
    assert.ok(cancelAlert?.dueDateLabel);
  });
});
