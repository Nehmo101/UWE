import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContractBillingInterval } from "./generated/prisma/client";
import {
  buildContractAlerts,
  formatEuroFromCents,
  normalizeToMonthlyCents,
  normalizeToYearlyCents,
  summarizeContractCosts,
} from "./contract-expense-utils";

describe("contract expense utils", () => {
  it("normalizes monthly and yearly amounts", () => {
    assert.equal(normalizeToMonthlyCents(1200, "monthly"), 1200);
    assert.equal(normalizeToMonthlyCents(12000, "yearly"), 1000);
    assert.equal(normalizeToYearlyCents(1000, "monthly"), 12000);
    assert.equal(normalizeToYearlyCents(5000, "once"), 5000);
  });

  it("summarizes active contract costs", () => {
    const summary = summarizeContractCosts([
      {
        id: "1",
        name: "Cloudflare",
        vendor: "",
        status: "active",
        expenseType: "subscription",
        billingInterval: "monthly" as ContractBillingInterval,
        categoryLabel: "",
        amountCents: 2000,
        currency: "EUR",
        billingDay: 1,
        startDate: null,
        nextPaymentDate: null,
        renewalDate: null,
        cancelByDate: null,
        portalUrl: null,
        notes: "",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "Domain",
        vendor: "",
        status: "archived",
        expenseType: "other",
        billingInterval: "yearly" as ContractBillingInterval,
        categoryLabel: "",
        amountCents: 1200,
        currency: "EUR",
        billingDay: null,
        startDate: null,
        nextPaymentDate: null,
        renewalDate: null,
        cancelByDate: null,
        portalUrl: null,
        notes: "",
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    assert.equal(summary.activeCount, 1);
    assert.equal(summary.monthlyTotalCents, 2000);
    assert.equal(formatEuroFromCents(summary.monthlyTotalCents), "20.00 €");
  });

  it("builds payment and cancel alerts", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const alerts = buildContractAlerts(
      [
        {
          id: "c1",
          name: "Spotify",
          vendor: "",
          status: "active",
          expenseType: "subscription",
          billingInterval: "monthly",
          categoryLabel: "",
          amountCents: 999,
          currency: "EUR",
          billingDay: 5,
          startDate: null,
          nextPaymentDate: new Date("2026-06-10T00:00:00Z"),
          renewalDate: null,
          cancelByDate: null,
          portalUrl: null,
          notes: "",
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "c2",
          name: "VPN",
          vendor: "",
          status: "review",
          expenseType: "subscription",
          billingInterval: "yearly",
          categoryLabel: "",
          amountCents: 5000,
          currency: "EUR",
          billingDay: null,
          startDate: null,
          nextPaymentDate: null,
          renewalDate: null,
          cancelByDate: null,
          portalUrl: null,
          notes: "",
          metadata: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      now,
    );

    assert.ok(alerts.some((alert) => alert.kind === "payment_soon"));
    assert.ok(alerts.some((alert) => alert.kind === "review"));
  });
});
