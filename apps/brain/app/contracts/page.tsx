import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { createContractAction, deleteContractAction } from "../brain-actions";

export const dynamic = "force-dynamic";

const STATUS: Array<{ value: string; label: string }> = [
  { value: "active", label: "Aktiv" },
  { value: "review", label: "Prüfen" },
  { value: "paused", label: "Pausiert" },
  { value: "cancelled", label: "Gekündigt" },
  { value: "archived", label: "Archiviert" },
];

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

  const expenses = await createLifeAdminService(brainPrisma, prisma).listContractExpenses();

  return (
    <BrainShell
      active="/contracts"
      title="Verträge & Kosten"
      lede={`${expenses.length} Vertrag/Verträge & Kostenposten — Abos, Rechnungen, Kündigungsfristen. Lokal, privat.`}
    >
      <section className="brain-section">
        <h2>Neuer Vertrag / Kostenposten</h2>
        <form action={createContractAction} className="brain-form brain-card">
          <label>
            Name
            <input name="name" required placeholder="z. B. Internet-Tarif" />
          </label>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Anbieter
              <input name="vendor" placeholder="z. B. Telekom" />
            </label>
            <label>
              Status
              <select name="status" defaultValue="active">
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label>
              Betrag (€)
              <input name="amount" inputMode="decimal" placeholder="39,99" />
            </label>
            <label>
              Nächste Zahlung
              <input name="nextPaymentDate" type="date" />
            </label>
          </div>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <div>
            <button type="submit" className="brain-btn">
              Speichern
            </button>
          </div>
        </form>
      </section>

      <section className="brain-section">
        <h2>Verträge · {expenses.length}</h2>
        {expenses.length === 0 ? (
          <p className="brain-muted">Keine Verträge erfasst.</p>
        ) : (
          <ul className="brain-list">
            {expenses.map((expense) => (
              <li key={expense.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{expense.name}</strong>
                  <span className="brain-tag">{expense.status}</span>
                  <span className="brain-muted">
                    {expense.vendor ? `${expense.vendor} · ` : ""}
                    {formatMoney(expense.amountCents, expense.currency)}
                    {expense.billingInterval ? ` / ${expense.billingInterval}` : ""}
                  </span>
                  <form action={deleteContractAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button type="submit" className="brain-btn brain-btn-ghost brain-btn-sm">
                      Löschen
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </BrainShell>
  );
}
