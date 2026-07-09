import Link from "next/link";
import { EmptyState } from "@uwe/shared-ui";
import { prisma } from "@uwe/database/server";
import {
  createFinanceOverviewService,
  type FinancePeriod,
} from "@uwe/database/finance-overview";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  all: "Alle",
  month: "Dieser Monat",
  quarter: "Dieses Quartal",
  year: "Dieses Jahr",
};

function parsePeriod(raw: string | undefined): FinancePeriod {
  if (raw === "month" || raw === "quarter" || raw === "year") return raw;
  return "all";
}

interface Props {
  searchParams: Promise<{ period?: string }>;
}

export default async function FinancePage({ searchParams }: Props) {
  await requireStudioAccess();
  const { period: periodRaw } = await searchParams;
  const period = parsePeriod(periodRaw);

  const overview = await createFinanceOverviewService(prisma).getOverview(new Date(), { period });
  const { totals, alerts, reviewCandidates, aiCosts, byCategory, byInterval } = overview;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Finanzen & Abos" }]} />}>
      <PageHeader
        title="Finanz- & Abo-Übersicht"
        summary="Laufende Kosten, Kündigungsfristen und „lohnt sich noch?“ auf einen Blick — reine Auswertung der Verträge, kein Banking."
      />

      <nav className="uwe-today-quick-chips uwe-v2-section" aria-label="Zeitraum">
        {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/finance" : `/finance?period=${key}`}
            className="uwe-today-quick-chip"
            data-severity={period === key ? "warn" : "info"}
            aria-current={period === key ? "page" : undefined}
          >
            {PERIOD_LABELS[key]}
          </Link>
        ))}
      </nav>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Gesamtkosten</h2>
        <div className="uwe-stat-grid">
          <div className="uwe-stat">
            <span className="uwe-stat-value">{totals.monthlyLabel}</span>
            <span className="uwe-stat-label">pro Monat</span>
          </div>
          <div className="uwe-stat">
            <span className="uwe-stat-value">{totals.yearlyLabel}</span>
            <span className="uwe-stat-label">pro Jahr</span>
          </div>
          <div className="uwe-stat">
            <span className="uwe-stat-value">{totals.activeCount}</span>
            <span className="uwe-stat-label">laufende Verträge</span>
          </div>
          <div className="uwe-stat">
            <span className="uwe-stat-value">{aiCosts.monthlyLabel}</span>
            <span className="uwe-stat-label">davon KI-Kosten / Monat</span>
          </div>
        </div>
        <p className="uwe-dashboard-muted">
          Details & Bearbeitung unter <Link href="/contracts">Verträge & Ausgaben</Link>.
        </p>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Fristen & Hinweise</h2>
        {alerts.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine anstehenden Kündigungs- oder Zahlungsfristen.</p>
        ) : (
          <ul className="uwe-inspector-findings">
            {alerts.map((alert) => (
              <li key={`${alert.contractId}-${alert.kind}`}>
                <strong>{alert.name}</strong> — {alert.message}
                {alert.dueDateLabel ? ` (bis ${alert.dueDateLabel})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Lohnt sich noch?</h2>
        {reviewCandidates.length === 0 ? (
          <p className="uwe-dashboard-muted">
            Keine Verträge zur Prüfung markiert und keine auffällig teuren Posten.
          </p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Vertrag</th>
                <th>Grund</th>
                <th>Monatlich</th>
                <th>Jährlich</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviewCandidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    <strong>{candidate.name}</strong>
                    {candidate.vendor ? ` · ${candidate.vendor}` : ""}
                  </td>
                  <td>{candidate.reasonLabel}</td>
                  <td>{candidate.monthlyLabel}</td>
                  <td>{candidate.yearlyLabel}</td>
                  <td>
                    <Link href="/contracts">Ansehen</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">KI-Kosten</h2>
        {aiCosts.itemCount === 0 ? (
          <p className="uwe-dashboard-muted">
            Keine KI-Kostenposten erfasst. Übernahme aus der Nutzung unter{" "}
            <Link href="/contracts">Verträge & Ausgaben</Link>.
          </p>
        ) : (
          <>
            <p>
              KI/Cloud gesamt: <strong>{aiCosts.monthlyLabel}</strong> pro Monat ·{" "}
              <strong>{aiCosts.yearlyLabel}</strong> pro Jahr ({aiCosts.itemCount} Posten).
            </p>
            <ul className="uwe-inspector-findings">
              {aiCosts.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong> · {item.monthlyLabel} / Monat
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Kosten nach Kategorie</h2>
        {byCategory.length === 0 ? (
          <EmptyState
            title="Noch keine Verträge"
            description="Sobald Abos und Ausgaben erfasst sind, erscheint hier die Aufschlüsselung."
            action={<Link href="/contracts">Verträge öffnen</Link>}
          />
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Anzahl</th>
                <th>Monatlich</th>
                <th>Jährlich</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((bucket) => (
                <tr key={bucket.key}>
                  <td>{bucket.label}</td>
                  <td>{bucket.count}</td>
                  <td>{bucket.monthlyLabel}</td>
                  <td>{bucket.yearlyLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Kosten nach Abrechnungsintervall</h2>
        {byInterval.length === 0 ? (
          <p className="uwe-dashboard-muted">Keine laufenden Verträge.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Intervall</th>
                <th>Anzahl</th>
                <th>Monatlich</th>
                <th>Jährlich</th>
              </tr>
            </thead>
            <tbody>
              {byInterval.map((bucket) => (
                <tr key={bucket.key}>
                  <td>{bucket.label}</td>
                  <td>{bucket.count}</td>
                  <td>{bucket.monthlyLabel}</td>
                  <td>{bucket.yearlyLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </StudioShell>
  );
}
