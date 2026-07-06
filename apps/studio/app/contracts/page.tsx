import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import {
  BILLING_INTERVAL_LABELS,
  buildContractAlerts,
  ContractBillingIntervalEnum,
  ContractStatusEnum,
  createLifeAdminService,
  formatEuroFromCents,
  formatUsdAmount,
  prisma,
  summarizeContractCosts,
  CONTRACT_STATUS_LABELS,
  type AiUsageRollupPeriod,
} from "@uwe/database/server";
import { AdminCreateCard, AdminEntityForm, AdminModulePage, BreadcrumbTrail } from "@/src/components/admin";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  createContractAction,
  deleteContractAction,
  syncAiUsageContractAction,
  updateContractAction,
} from "../life-admin-actions";

const AI_PERIOD_OPTIONS: Array<{ value: AiUsageRollupPeriod; label: string }> = [
  { value: "current_month", label: "Aktueller Monat" },
  { value: "last_30_days", label: "Letzte 30 Tage" },
  { value: "current_year", label: "Aktuelles Jahr" },
];

function resolveAiPeriod(value: string | undefined): AiUsageRollupPeriod {
  if (value === "last_30_days" || value === "current_year") {
    return value;
  }
  return "current_month";
}

type Props = {
  searchParams: Promise<{ period?: string; aiSynced?: string }>;
};

export default async function ContractsPage({ searchParams }: Props) {
  await requireStudioAccess();

  const { period: periodParam, aiSynced } = await searchParams;
  const aiPeriod = resolveAiPeriod(periodParam);
  const lifeAdmin = createLifeAdminService(prisma);

  const [manualContracts, aiUsageContracts, aiRollup] = await Promise.all([
    lifeAdmin.listContractExpenses({ source: "manual", limit: 200 }),
    lifeAdmin.listContractExpenses({ source: "ai_usage", limit: 12 }),
    lifeAdmin.getAiUsageCostRollups({ period: aiPeriod }),
  ]);

  const contracts = manualContracts;
  const costs = summarizeContractCosts([...manualContracts, ...aiUsageContracts]);
  const alerts = buildContractAlerts(contracts);
  const syncedAiContract = aiUsageContracts.find((entry) =>
    entry.name.includes(aiRollup.periodLabel),
  );

  return (
    <AdminModulePage
      breadcrumb={<BreadcrumbTrail items={[{ label: "Verträge & Ausgaben" }]} />}
      title="Verträge & Monatsausgaben"
      summary="Manuelle Verwaltung ohne Bankdaten — Abos, Miete, Versicherungen und KI-Kosten."
    >

      <AdminCreateCard title="KI-Kosten (Schätzung)">
        <p className="uwe-dashboard-muted">
          Rollup aus <code>ai_usage_logs</code> — nur Cloud-Schätzungen (RTX = 0 USD). Keine
          Prompt-Inhalte.
        </p>
        <div className="uwe-brain-create-form" style={{ marginBottom: "1rem" }}>
          {AI_PERIOD_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/contracts?period=${option.value}`}
              className={
                option.value === aiPeriod
                  ? "uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
                  : "uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
        <p>
          Zeitraum: <strong>{aiRollup.periodLabel}</strong> · Anfragen: {aiRollup.requestCount} ·
          Tokens: {aiRollup.inputTokens + aiRollup.outputTokens} · Geschätzt:{" "}
          <strong>{formatUsdAmount(aiRollup.estimatedCostUsd)}</strong>
        </p>
        {aiSynced === "1" && (
          <p className="uwe-dashboard-muted">KI-Monatskosten als Vertragseintrag übernommen.</p>
        )}
        {syncedAiContract && (
          <p className="uwe-dashboard-muted">
            Verknüpfter Eintrag: {syncedAiContract.name} ·{" "}
            {formatEuroFromCents(syncedAiContract.amountCents ?? 0)} (EUR-Schätzung)
          </p>
        )}
        <form action={syncAiUsageContractAction} style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="period" value={aiPeriod} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Monatskosten als Vertragseintrag übernehmen
          </button>
        </form>

        {aiRollup.byFeature.length > 0 && (
          <>
            <h3 className="uwe-v2-section-title">Nach Feature</h3>
            <table className="uwe-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Anfragen</th>
                  <th>Tokens</th>
                  <th>USD (Schätzung)</th>
                </tr>
              </thead>
              <tbody>
                {aiRollup.byFeature.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td>{row.requestCount}</td>
                    <td>{row.inputTokens + row.outputTokens}</td>
                    <td>{formatUsdAmount(row.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {aiRollup.byUser.length > 0 && (
          <>
            <h3 className="uwe-v2-section-title">Nach User</h3>
            <table className="uwe-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Anfragen</th>
                  <th>Tokens</th>
                  <th>USD (Schätzung)</th>
                </tr>
              </thead>
              <tbody>
                {aiRollup.byUser.map((row) => (
                  <tr key={row.userId ?? "system"}>
                    <td>{row.userDisplayName ?? "Unbekannt"}</td>
                    <td>{row.requestCount}</td>
                    <td>{row.inputTokens + row.outputTokens}</td>
                    <td>{formatUsdAmount(row.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {aiRollup.requestCount === 0 && (
          <p className="uwe-dashboard-muted">Keine erfolgreichen KI-Aufrufe in diesem Zeitraum.</p>
        )}

        <p className="uwe-dashboard-muted">
          Detail-Logs und Budgets:{" "}
          <Link href="/admin/ai-gateway">AI Gateway (Owner)</Link>
        </p>
      </AdminCreateCard>

      <AdminCreateCard title="Kostenübersicht">
        <p>
          Monatlich (aktiv, inkl. KI-Schätzung): {formatEuroFromCents(costs.monthlyTotalCents)} ·
          Jährlich: {formatEuroFromCents(costs.yearlyTotalCents)} · Aktive Verträge:{" "}
          {costs.activeCount}
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
      </AdminCreateCard>

      <AdminCreateCard title="Neuer Vertrag / Ausgabe">
        <AdminEntityForm
          action={createContractAction}
          submitLabel="Vertrag anlegen"
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "vendor", label: "Anbieter" },
            {
              name: "categoryLabel",
              label: "Kategorie",
              placeholder: "z. B. Cloud, Versicherung",
            },
            {
              name: "billingInterval",
              label: "Intervall",
              type: "select",
              defaultValue: "monthly",
              options: Object.values(ContractBillingIntervalEnum).map((interval) => ({
                value: interval,
                label: BILLING_INTERVAL_LABELS[interval],
              })),
            },
            { name: "amountCents", label: "Betrag (Cent)", type: "number", min: 0 },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "active",
              options: Object.values(ContractStatusEnum).map((status) => ({
                value: status,
                label: CONTRACT_STATUS_LABELS[status],
              })),
            },
            { name: "nextPaymentDate", label: "Nächste Zahlung", type: "date" },
            { name: "cancelByDate", label: "Kündigen bis", type: "date" },
            { name: "portalUrl", label: "Portal-Link", type: "url" },
            { name: "notes", label: "Notizen", type: "textarea", rows: 2 },
          ]}
        />
      </AdminCreateCard>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Verträge ({contracts.length})</h2>
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
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Speichern
                  </button>
                </form>
                <form action={deleteContractAction}>
                  <input type="hidden" name="id" value={contract.id} />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      {aiUsageContracts.length > 0 && (
        <AdminCreateCard title="KI-Vertragseinträge (automatisch)">
          <ul className="uwe-inspector-findings">
            {aiUsageContracts.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name}</strong> · {formatEuroFromCents(entry.amountCents ?? 0)} ·{" "}
                {CONTRACT_STATUS_LABELS[entry.status]}
              </li>
            ))}
          </ul>
        </AdminCreateCard>
      )}
    </AdminModulePage>
  );
}
