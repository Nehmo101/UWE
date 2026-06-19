import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  BILLING_INTERVAL_LABELS,
  buildContractAlerts,
  ContractBillingIntervalEnum,
  ContractStatusEnum,
  createLifeAdminService,
  formatEuroFromCents,
  prisma,
  summarizeContractCosts,
  CONTRACT_STATUS_LABELS,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import {
  createContractAction,
  deleteContractAction,
  updateContractAction,
} from "../life-admin-actions";

export default async function ContractsPage() {
  const contracts = await createLifeAdminService(prisma).listContractExpenses({ limit: 200 });
  const costs = summarizeContractCosts(contracts);
  const alerts = buildContractAlerts(contracts);

  return (
    <AdminModuleShell
      activePath="/contracts"
      title="Verträge & Monatsausgaben"
      summary="Manuelle Verwaltung ohne Bankdaten — Abos, Miete, Versicherungen."
    >
      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Kostenübersicht</h2>
        <p>
          Monatlich (aktiv): {formatEuroFromCents(costs.monthlyTotalCents)} · Jährlich:{" "}
          {formatEuroFromCents(costs.yearlyTotalCents)} · Aktive Verträge: {costs.activeCount}
        </p>
        {alerts.length > 0 && (
          <ul className="uwe-inspector-findings">
            {alerts.map((alert) => (
              <li key={`${alert.contractId}-${alert.kind}`}>
                <strong>{alert.name}</strong> — {alert.message}{" "}
                {alert.dueDate && (
                  <Link href={`/mail/compose?kind=contract_reminder&sourceId=${alert.contractId}`}>
                    Mail vorbereiten
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-card uwe-section">
        <h2 className="uwe-section-title">Neuer Vertrag / Ausgabe</h2>
        <form action={createContractAction} className="uwe-brain-create-form">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Anbieter
            <input name="vendor" />
          </label>
          <label>
            Kategorie
            <input name="categoryLabel" placeholder="z. B. Cloud, Versicherung" />
          </label>
          <label>
            Intervall
            <select name="billingInterval" defaultValue="monthly">
              {Object.values(ContractBillingIntervalEnum).map((interval) => (
                <option key={interval} value={interval}>
                  {BILLING_INTERVAL_LABELS[interval]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Betrag (Cent)
            <input name="amountCents" type="number" min={0} />
          </label>
          <label>
            Status
            <select name="status" defaultValue="active">
              {Object.values(ContractStatusEnum).map((status) => (
                <option key={status} value={status}>
                  {CONTRACT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nächste Zahlung
            <input name="nextPaymentDate" type="date" />
          </label>
          <label>
            Kündigen bis
            <input name="cancelByDate" type="date" />
          </label>
          <label>
            Portal-Link
            <input name="portalUrl" type="url" />
          </label>
          <label>
            Notizen
            <textarea name="notes" rows={2} />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary">
            Vertrag anlegen
          </button>
        </form>
      </section>

      <section className="uwe-section">
        <h2 className="uwe-section-title">Verträge ({contracts.length})</h2>
        {contracts.length === 0 ? (
          <EmptyState
            title="Noch keine Verträge"
            description="Trage Abos und wiederkehrende Ausgaben manuell ein."
            action={<Link href="/capture">Capture öffnen</Link>}
          />
        ) : (
          <div className="uwe-today-card-list">
            {contracts.map((contract) => (
              <article key={contract.id} className="uwe-today-card">
                <form action={updateContractAction} className="uwe-brain-create-form">
                  <input type="hidden" name="id" value={contract.id} />
                  <label>
                    Name
                    <input name="name" defaultValue={contract.name} required />
                  </label>
                  <label>
                    Anbieter
                    <input name="vendor" defaultValue={contract.vendor} />
                  </label>
                  <label>
                    Intervall
                    <select name="billingInterval" defaultValue={contract.billingInterval}>
                      {Object.values(ContractBillingIntervalEnum).map((interval) => (
                        <option key={interval} value={interval}>
                          {BILLING_INTERVAL_LABELS[interval]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Betrag (Cent)
                    <input
                      name="amountCents"
                      type="number"
                      min={0}
                      defaultValue={contract.amountCents ?? ""}
                    />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={contract.status}>
                      {Object.values(ContractStatusEnum).map((status) => (
                        <option key={status} value={status}>
                          {CONTRACT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nächste Zahlung
                    <input
                      name="nextPaymentDate"
                      type="date"
                      defaultValue={
                        contract.nextPaymentDate
                          ? contract.nextPaymentDate.toISOString().slice(0, 10)
                          : ""
                      }
                    />
                  </label>
                  <label>
                    Notizen
                    <textarea name="notes" rows={2} defaultValue={contract.notes} />
                  </label>
                  <p className="uwe-dashboard-muted">
                    {CONTRACT_STATUS_LABELS[contract.status]} ·{" "}
                    {formatEuroFromCents(contract.amountCents ?? 0)} ·{" "}
                    {BILLING_INTERVAL_LABELS[contract.billingInterval]}
                  </p>
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deleteContractAction}>
                  <input type="hidden" name="id" value={contract.id} />
                  <button type="submit" className="uwe-btn uwe-btn-secondary uwe-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminModuleShell>
  );
}
