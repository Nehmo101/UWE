import { createLifeAdminService, prisma } from "@uwe/database/server";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

export const dynamic = "force-dynamic";

function formatMoney(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  try {
    return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: currency || "EUR" });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function BrainContractsPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/contracts" title="Verträge">
        <BrainDenied />
      </BrainShell>
    );
  }

  const expenses = await createLifeAdminService(prisma).listContractExpenses();

  return (
    <BrainShell active="/contracts" title="Verträge & Kosten">
      <p>{expenses.length} Vertrag/Verträge &amp; Kostenposten — lokal, privat.</p>
      {expenses.length === 0 ? (
        <p>Keine Verträge erfasst.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0", display: "grid", gap: "0.6rem" }}>
          {expenses.map((expense) => (
            <li key={expense.id} className="brain-row">
              <strong>{expense.name}</strong>
              <span className="brain-tag">{expense.status}</span>
              <span className="brain-muted">
                {" "}· {expense.vendor} · {formatMoney(expense.amountCents, expense.currency)} / {expense.billingInterval}
              </span>
            </li>
          ))}
        </ul>
      )}
    </BrainShell>
  );
}
