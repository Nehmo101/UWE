import {
  BILLING_INTERVAL_LABELS,
  buildContractAlerts,
  CONTRACT_STATUS_LABELS,
  createLifeAdminService,
  formatEuroFromCents,
  prisma,
  type ContractExpense,
} from "@uwe/database/server";
import {
  createFinanceOverviewService,
  type FinancePeriod,
} from "@uwe/database/finance-overview";
import { brainPrisma } from "@uwe/database/brain-client";
import { familyPrisma } from "@uwe/database/family-client";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { FamilyContractOverview } from "@/src/components/FamilyContractOverview";
import {
  createContractAction,
  deleteContractAction,
  updateContractAction,
} from "../contracts-actions";

/**
 * Verträge & wiederkehrende Kosten (H7) — die einzige Fassung.
 *
 * Vorher gab es das dreimal auf derselben Tabelle: Brains `/contracts`, Studios
 * `/contracts` und Studios `/finance`. Alles gehört nach Family — eine Miete
 * oder ein Streaming-Abo ist Haushaltssache, nicht DM-Arbeit und nicht
 * owner-privat.
 *
 * Auswertung oben, Liste unten. Studios Finanzseite war eine eigene Tür zu
 * denselben Zeilen; sie steht jetzt über der Liste, die sie auswertet.
 */

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_LABELS);
const INTERVAL_OPTIONS = Object.entries(BILLING_INTERVAL_LABELS);

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  subscription: "Abo",
  rent: "Miete",
  insurance: "Versicherung",
  utility: "Nebenkosten",
  software: "Software",
  other: "Sonstiges",
};

function isoDate(value: Date | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function euros(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function ContractFields({ contract }: { contract?: ContractExpense }) {
  return (
    <>
      <div className="family-form-row">
        <label>
          Name
          <input name="name" defaultValue={contract?.name ?? ""} required placeholder="z. B. Internet-Tarif" />
        </label>
        <label>
          Anbieter
          <input name="vendor" defaultValue={contract?.vendor ?? ""} placeholder="z. B. Telekom" />
        </label>
      </div>
      <div className="family-form-row">
        <label>
          Art
          <select name="expenseType" defaultValue={contract?.expenseType ?? "other"}>
            {Object.entries(EXPENSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kategorie
          <input
            name="categoryLabel"
            defaultValue={contract?.categoryLabel ?? ""}
            placeholder="frei, z. B. Auto"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={contract?.status ?? "active"}>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="family-form-row">
        <label>
          Betrag (€)
          <input
            name="amountEuros"
            inputMode="decimal"
            defaultValue={euros(contract?.amountCents ?? null)}
            placeholder="39,99"
          />
        </label>
        <label>
          Intervall
          <select name="billingInterval" defaultValue={contract?.billingInterval ?? "monthly"}>
            {INTERVAL_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="family-form-row">
        <label>
          Nächste Zahlung
          <input
            name="nextPaymentDate"
            type="date"
            defaultValue={isoDate(contract?.nextPaymentDate ?? null)}
          />
        </label>
        <label>
          Kündigen bis
          <input name="cancelByDate" type="date" defaultValue={isoDate(contract?.cancelByDate ?? null)} />
        </label>
        <label>
          Verlängerung
          <input name="renewalDate" type="date" defaultValue={isoDate(contract?.renewalDate ?? null)} />
        </label>
      </div>
      <label>
        Portal-Link
        <input name="portalUrl" type="url" defaultValue={contract?.portalUrl ?? ""} />
      </label>
      <label>
        Notizen
        <textarea name="notes" rows={2} defaultValue={contract?.notes ?? ""} />
      </label>
    </>
  );
}

function parsePeriod(raw: string | undefined): FinancePeriod {
  return raw === "month" || raw === "quarter" || raw === "year" ? raw : "all";
}

export default async function FamilyContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/contracts" title="Verträge">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const period = parsePeriod((await searchParams).period);
  const [contracts, overview] = await Promise.all([
    createLifeAdminService(brainPrisma, prisma, familyPrisma).listContractExpenses({ limit: 200 }),
    createFinanceOverviewService(familyPrisma).getOverview(new Date(), { period }),
  ]);

  return (
    <FamilyShell
      active="/contracts"
      title="Verträge & Kosten"
      eyebrow="Gemeinsamer Bereich"
      lede={`${contracts.length} Eintrag/Einträge — Abos, Miete, Versicherungen. Ohne Bankzugang, alles von Hand gepflegt.`}
    >
      <FamilyContractOverview overview={overview} period={period} />

      <section className="family-section">
        <h2>Neuer Vertrag</h2>
        <form action={createContractAction} className="family-form family-card">
          <ContractFields />
          <div>
            <button type="submit" className="family-btn">
              Vertrag anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="family-section">
        <h2>Alle · {contracts.length}</h2>
        {contracts.length === 0 ? (
          <p className="family-muted">Noch nichts erfasst.</p>
        ) : (
          <ul className="family-list">
            {contracts.map((contract) => {
              const own = buildContractAlerts([contract]);
              return (
                <li key={contract.id} className="family-row">
                  <div className="family-row-head">
                    <strong>{contract.name}</strong>
                    <span className="family-tag">{CONTRACT_STATUS_LABELS[contract.status]}</span>
                    <span className="family-muted">
                      {contract.vendor ? `${contract.vendor} · ` : ""}
                      {formatEuroFromCents(contract.amountCents ?? 0)} ·{" "}
                      {BILLING_INTERVAL_LABELS[contract.billingInterval]}
                    </span>
                    <form action={deleteContractAction} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={contract.id} />
                      <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                        Löschen
                      </button>
                    </form>
                  </div>
                  {own.length > 0 ? (
                    <p className="family-callout family-callout-warn">
                      {own.map((alert) => alert.message).join(" · ")}
                    </p>
                  ) : null}
                  <details className="family-edit">
                    <summary>Bearbeiten</summary>
                    <form action={updateContractAction} className="family-form">
                      <input type="hidden" name="id" value={contract.id} />
                      <ContractFields contract={contract} />
                      <div>
                        <button type="submit" className="family-btn family-btn-sm">
                          Speichern
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </FamilyShell>
  );
}
