import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createFinanceOverviewService,
  type FinancePeriod,
} from "@uwe/database/finance-overview";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import {
  badgeVariants,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from "@/src/components/ui";
import { requireStudioAccess } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  all: "Alle",
  month: "Dieser Monat",
  quarter: "Dieses Quartal",
  year: "Dieses Jahr",
};

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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

  const overview = await createFinanceOverviewService(brainPrisma).getOverview(new Date(), { period });
  const { totals, alerts, reviewCandidates, aiCosts, byCategory, byInterval } = overview;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Finanzen & Abos" }]} />}>
      <PageHeader
        title="Finanz- & Abo-Übersicht"
        summary="Laufende Kosten, Kündigungsfristen und „lohnt sich noch?“ auf einen Blick — reine Auswertung der Verträge, kein Banking."
      />

      <div className="flex flex-col gap-6">
        <nav className="flex flex-wrap gap-2" aria-label="Zeitraum">
          {(Object.keys(PERIOD_LABELS) as FinancePeriod[]).map((key) => (
            <Link
              key={key}
              href={key === "all" ? "/finance" : `/finance?period=${key}`}
              aria-current={period === key ? "page" : undefined}
              className={cn(
                badgeVariants({ variant: period === key ? "accent" : "default" }),
                "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {PERIOD_LABELS[key]}
            </Link>
          ))}
        </nav>

        <Card>
          <CardHeader>
            <CardTitle>Gesamtkosten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[var(--radius)] border border-border p-4">
                <div className="text-2xl font-semibold">{totals.monthlyLabel}</div>
                <div className="text-sm text-muted-foreground">pro Monat</div>
              </div>
              <div className="rounded-[var(--radius)] border border-border p-4">
                <div className="text-2xl font-semibold">{totals.yearlyLabel}</div>
                <div className="text-sm text-muted-foreground">pro Jahr</div>
              </div>
              <div className="rounded-[var(--radius)] border border-border p-4">
                <div className="text-2xl font-semibold">{totals.activeCount}</div>
                <div className="text-sm text-muted-foreground">laufende Verträge</div>
              </div>
              <div className="rounded-[var(--radius)] border border-border p-4">
                <div className="text-2xl font-semibold">{aiCosts.monthlyLabel}</div>
                <div className="text-sm text-muted-foreground">davon KI-Kosten / Monat</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Details & Bearbeitung unter <Link href="/contracts">Verträge & Ausgaben</Link>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fristen & Hinweise</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine anstehenden Kündigungs- oder Zahlungsfristen.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((alert) => (
                  <li
                    key={`${alert.contractId}-${alert.kind}`}
                    className="border-l-2 border-warning/60 pl-3"
                  >
                    <strong>{alert.name}</strong> — {alert.message}
                    {alert.dueDateLabel ? ` (bis ${alert.dueDateLabel})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lohnt sich noch?</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Verträge zur Prüfung markiert und keine auffällig teuren Posten.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Vertrag</th>
                      <th className={TH_CLASS}>Grund</th>
                      <th className={TH_CLASS}>Monatlich</th>
                      <th className={TH_CLASS}>Jährlich</th>
                      <th className={TH_CLASS}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className={TD_CLASS}>
                          <strong>{candidate.name}</strong>
                          {candidate.vendor ? ` · ${candidate.vendor}` : ""}
                        </td>
                        <td className={TD_CLASS}>{candidate.reasonLabel}</td>
                        <td className={TD_CLASS}>{candidate.monthlyLabel}</td>
                        <td className={TD_CLASS}>{candidate.yearlyLabel}</td>
                        <td className={TD_CLASS}>
                          <Link href="/contracts">Ansehen</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KI-Kosten</CardTitle>
          </CardHeader>
          <CardContent>
            {aiCosts.itemCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine KI-Kostenposten erfasst. Übernahme aus der Nutzung unter{" "}
                <Link href="/contracts">Verträge & Ausgaben</Link>.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  KI/Cloud gesamt: <strong>{aiCosts.monthlyLabel}</strong> pro Monat ·{" "}
                  <strong>{aiCosts.yearlyLabel}</strong> pro Jahr ({aiCosts.itemCount} Posten).
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {aiCosts.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4">
                      <strong>{item.name}</strong>
                      <span className="text-muted-foreground">{item.monthlyLabel} / Monat</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kosten nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <EmptyState
                title="Noch keine Verträge"
                description="Sobald Abos und Ausgaben erfasst sind, erscheint hier die Aufschlüsselung."
                action={
                  <Link href="/contracts" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Verträge öffnen
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Kategorie</th>
                      <th className={TH_CLASS}>Anzahl</th>
                      <th className={TH_CLASS}>Monatlich</th>
                      <th className={TH_CLASS}>Jährlich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map((bucket) => (
                      <tr key={bucket.key}>
                        <td className={TD_CLASS}>{bucket.label}</td>
                        <td className={TD_CLASS}>{bucket.count}</td>
                        <td className={TD_CLASS}>{bucket.monthlyLabel}</td>
                        <td className={TD_CLASS}>{bucket.yearlyLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kosten nach Abrechnungsintervall</CardTitle>
          </CardHeader>
          <CardContent>
            {byInterval.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine laufenden Verträge.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Intervall</th>
                      <th className={TH_CLASS}>Anzahl</th>
                      <th className={TH_CLASS}>Monatlich</th>
                      <th className={TH_CLASS}>Jährlich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byInterval.map((bucket) => (
                      <tr key={bucket.key}>
                        <td className={TD_CLASS}>{bucket.label}</td>
                        <td className={TD_CLASS}>{bucket.count}</td>
                        <td className={TD_CLASS}>{bucket.monthlyLabel}</td>
                        <td className={TD_CLASS}>{bucket.yearlyLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StudioShell>
  );
}
