import type { ContractBillingInterval, ContractExpense } from "./generated/prisma/client";

export const BILLING_INTERVAL_LABELS: Record<ContractBillingInterval, string> = {
  monthly: "Monatlich",
  yearly: "Jährlich",
  once: "Einmalig",
  other: "Sonstig",
};

export interface ContractCostSummary {
  monthlyTotalCents: number;
  yearlyTotalCents: number;
  activeCount: number;
}

export interface ContractAlert {
  contractId: string;
  name: string;
  kind: "review" | "cancel_soon" | "payment_soon";
  message: string;
  dueDate: Date | null;
}

const MS_PER_DAY = 86_400_000;

export function normalizeToMonthlyCents(
  amountCents: number | null | undefined,
  interval: ContractBillingInterval,
): number {
  if (amountCents == null || amountCents <= 0) {
    return 0;
  }

  switch (interval) {
    case "monthly":
      return amountCents;
    case "yearly":
      return Math.round(amountCents / 12);
    case "once":
      return 0;
    default:
      return amountCents;
  }
}

export function normalizeToYearlyCents(
  amountCents: number | null | undefined,
  interval: ContractBillingInterval,
): number {
  if (amountCents == null || amountCents <= 0) {
    return 0;
  }

  switch (interval) {
    case "monthly":
      return amountCents * 12;
    case "yearly":
      return amountCents;
    case "once":
      return amountCents;
    default:
      return amountCents * 12;
  }
}

export function summarizeContractCosts(contracts: ContractExpense[]): ContractCostSummary {
  let monthlyTotalCents = 0;
  let yearlyTotalCents = 0;
  let activeCount = 0;

  for (const contract of contracts) {
    if (contract.status !== "active" && contract.status !== "review") {
      continue;
    }
    activeCount += 1;
    monthlyTotalCents += normalizeToMonthlyCents(contract.amountCents, contract.billingInterval);
    yearlyTotalCents += normalizeToYearlyCents(contract.amountCents, contract.billingInterval);
  }

  return { monthlyTotalCents, yearlyTotalCents, activeCount };
}

export function buildContractAlerts(
  contracts: ContractExpense[],
  now: Date = new Date(),
  horizonDays = 14,
): ContractAlert[] {
  const alerts: ContractAlert[] = [];
  const horizonMs = horizonDays * MS_PER_DAY;

  for (const contract of contracts) {
    if (contract.status === "review") {
      alerts.push({
        contractId: contract.id,
        name: contract.name,
        kind: "review",
        message: "Vertrag zur Prüfung markiert",
        dueDate: null,
      });
    }

    if (contract.cancelByDate) {
      const delta = contract.cancelByDate.getTime() - now.getTime();
      if (delta >= 0 && delta <= horizonMs) {
        alerts.push({
          contractId: contract.id,
          name: contract.name,
          kind: "cancel_soon",
          message: "Kündigungsfrist läuft bald ab",
          dueDate: contract.cancelByDate,
        });
      }
    }

    const paymentDate = contract.nextPaymentDate ?? contract.renewalDate;
    if (paymentDate && contract.status === "active") {
      const delta = paymentDate.getTime() - now.getTime();
      if (delta >= 0 && delta <= horizonMs) {
        alerts.push({
          contractId: contract.id,
          name: contract.name,
          kind: "payment_soon",
          message: "Zahlung demnächst fällig",
          dueDate: paymentDate,
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const aTime = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

export function formatEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}
