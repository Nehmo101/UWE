import Link from "next/link";
import type { FinanceOverview, FinancePeriod } from "@uwe/database/finance-overview";

/**
 * Auswertung der Verträge: Summen, Fristen, „lohnt sich noch?" und die
 * Aufschlüsselung nach Kategorie und Intervall.
 *
 * Das war in Studio eine eigene Seite (`/finance`) neben `/contracts` — zwei
 * Türen zu denselben Zeilen. Hier steht die Auswertung über der Liste, die sie
 * auswertet.
 *
 * Die KI-Kosten-Kachel ist nicht mitgekommen: seit dem Wegfall der
 * Cloud-Anbieter (N.3) läuft jede Anfrage über den Maschinenraum-Host und kostet nichts.
 */

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  all: "Alle",
  month: "Dieser Monat",
  quarter: "Dieses Quartal",
  year: "Dieses Jahr",
};

function Buckets({
  title,
  buckets,
}: {
  title: string;
  buckets: FinanceOverview["byCategory"];
}) {
  if (buckets.length === 0) return null;
  return (
    <section className="family-section">
      <h2>{title}</h2>
      <ul className="family-list">
        {buckets.map((bucket) => (
          <li key={bucket.key} className="family-row">
            <div className="family-row-head">
              <strong>{bucket.label}</strong>
              <span className="family-tag">{bucket.count}</span>
              <span className="family-muted">
                {bucket.monthlyLabel} / Monat · {bucket.yearlyLabel} / Jahr
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FamilyContractOverview({
  overview,
  period,
}: {
  overview: FinanceOverview;
  period: FinancePeriod;
}) {
  const { totals, alerts, reviewCandidates, byCategory, byInterval } = overview;

  return (
    <>
      <div className="family-kpis">
        <div className="family-kpi">
          <strong>{totals.monthlyLabel}</strong>
          <span>pro Monat</span>
        </div>
        <div className="family-kpi">
          <strong>{totals.yearlyLabel}</strong>
          <span>pro Jahr</span>
        </div>
        <div className="family-kpi">
          <strong>{totals.activeCount}</strong>
          <span>laufend</span>
        </div>
      </div>

      <nav className="family-head-actions" aria-label="Zeitraum">
        {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((key) => (
          <Link
            key={key}
            href={key === "all" ? "/contracts" : `/contracts?period=${key}`}
            aria-current={period === key ? "page" : undefined}
            className={
              period === key
                ? "family-btn family-btn-sm"
                : "family-btn family-btn-ghost family-btn-sm"
            }
          >
            {PERIOD_LABELS[key]}
          </Link>
        ))}
      </nav>

      {alerts.length > 0 ? (
        <section className="family-section">
          <h2>Fristen · {alerts.length}</h2>
          <ul className="family-list">
            {alerts.map((alert) => (
              <li
                key={`${alert.contractId}-${alert.kind}`}
                className="family-callout family-callout-warn"
              >
                <strong>{alert.name}</strong> — {alert.message}
                {alert.dueDateLabel ? ` (bis ${alert.dueDateLabel})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reviewCandidates.length > 0 ? (
        <section className="family-section">
          <h2>Lohnt sich noch? · {reviewCandidates.length}</h2>
          <ul className="family-list">
            {reviewCandidates.map((candidate) => (
              <li key={candidate.id} className="family-row">
                <div className="family-row-head">
                  <strong>{candidate.name}</strong>
                  <span className="family-tag">{candidate.reasonLabel}</span>
                  <span className="family-muted">
                    {candidate.vendor ? `${candidate.vendor} · ` : ""}
                    {candidate.monthlyLabel} / Monat · {candidate.yearlyLabel} / Jahr
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Buckets title="Nach Kategorie" buckets={byCategory} />
      <Buckets title="Nach Abrechnungsintervall" buckets={byInterval} />
    </>
  );
}
