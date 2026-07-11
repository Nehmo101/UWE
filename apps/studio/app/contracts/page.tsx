import Link from "next/link";
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
import { BreadcrumbTrail, PageHeader, StudioShell } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import {
  createContractAction,
  deleteContractAction,
  syncAiUsageContractAction,
  updateContractAction,
} from "../life-admin-actions";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

const AI_PERIOD_OPTIONS: Array<{ value: AiUsageRollupPeriod; label: string }> = [
  { value: "current_month", label: "Aktueller Monat" },
  { value: "last_30_days", label: "Letzte 30 Tage" },
  { value: "current_year", label: "Aktuelles Jahr" },
];

const EURO_FORMAT = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Verträge & Ausgaben" }]} />}>
      <PageHeader
        title="Verträge & Monatsausgaben"
        summary="Manuelle Verwaltung ohne Bankdaten — Abos, Miete, Versicherungen und KI-Kosten."
      />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Verträge ({contracts.length})</h2>
          {contracts.length === 0 ? (
            <EmptyState
              title="Noch keine Verträge"
              description="Trage Abos und wiederkehrende Ausgaben manuell ein."
              action={
                <Link href="/capture" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Capture öffnen
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {contracts.map((contract) => {
                const contractAlerts = buildContractAlerts([contract]);
                return (
                  <Card key={contract.id}>
                    <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                      <CardTitle className="text-base">{contract.name}</CardTitle>
                      <Badge variant="default">{BILLING_INTERVAL_LABELS[contract.billingInterval]}</Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="text-sm">
                        <strong>{EURO_FORMAT.format((contract.amountCents ?? 0) / 100)}</strong>
                      </p>
                      {contract.nextPaymentDate ? (
                        <p className="text-sm text-muted-foreground">
                          Nächste Zahlung: {contract.nextPaymentDate.toLocaleDateString("de-DE")}
                        </p>
                      ) : null}
                      {contractAlerts.length > 0 ? (
                        <p className="border-l-2 border-warning/60 pl-3 text-sm text-warning">
                          {contractAlerts.map((alert) => alert.message).join(" · ")}
                        </p>
                      ) : null}

                      <details>
                        <summary className="cursor-pointer text-sm font-medium">Bearbeiten</summary>
                        <form
                          action={updateContractAction}
                          className="mt-3 grid gap-3 sm:grid-cols-2"
                        >
                          <input type="hidden" name="id" value={contract.id} />
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-name`}>Name</Label>
                            <Input
                              id={`contract-${contract.id}-name`}
                              name="name"
                              defaultValue={contract.name}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-vendor`}>Anbieter</Label>
                            <Input
                              id={`contract-${contract.id}-vendor`}
                              name="vendor"
                              defaultValue={contract.vendor}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-interval`}>Intervall</Label>
                            <Select name="billingInterval" defaultValue={contract.billingInterval}>
                              <SelectTrigger id={`contract-${contract.id}-interval`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(ContractBillingIntervalEnum).map((interval) => (
                                  <SelectItem key={interval} value={interval}>
                                    {BILLING_INTERVAL_LABELS[interval]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-amount`}>Betrag (€)</Label>
                            <Input
                              id={`contract-${contract.id}-amount`}
                              name="amountEuros"
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={
                                contract.amountCents != null
                                  ? (contract.amountCents / 100).toFixed(2)
                                  : ""
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-status`}>Status</Label>
                            <Select name="status" defaultValue={contract.status}>
                              <SelectTrigger id={`contract-${contract.id}-status`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(ContractStatusEnum).map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {CONTRACT_STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-next-payment`}>Nächste Zahlung</Label>
                            <Input
                              id={`contract-${contract.id}-next-payment`}
                              name="nextPaymentDate"
                              type="date"
                              defaultValue={
                                contract.nextPaymentDate
                                  ? contract.nextPaymentDate.toISOString().slice(0, 10)
                                  : ""
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`contract-${contract.id}-cancel-by`}>Kündigen bis</Label>
                            <Input
                              id={`contract-${contract.id}-cancel-by`}
                              name="cancelByDate"
                              type="date"
                              defaultValue={
                                contract.cancelByDate
                                  ? contract.cancelByDate.toISOString().slice(0, 10)
                                  : ""
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor={`contract-${contract.id}-notes`}>Notizen</Label>
                            <Textarea
                              id={`contract-${contract.id}-notes`}
                              name="notes"
                              rows={2}
                              defaultValue={contract.notes}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground sm:col-span-2">
                            {CONTRACT_STATUS_LABELS[contract.status]} ·{" "}
                            {formatEuroFromCents(contract.amountCents ?? 0)} ·{" "}
                            {BILLING_INTERVAL_LABELS[contract.billingInterval]}
                          </p>
                          <div className="sm:col-span-2">
                            <Button type="submit" variant="secondary" size="sm">
                              Speichern
                            </Button>
                          </div>
                        </form>
                        <form action={deleteContractAction} className="mt-4">
                          <input type="hidden" name="id" value={contract.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            Löschen
                          </Button>
                        </form>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <details
          className="rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm"
          open={contracts.length === 0}
        >
          <summary className="cursor-pointer font-semibold">+ Neuer Vertrag</summary>
          <form action={createContractAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-name">Name</Label>
              <Input id="contract-new-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-vendor">Anbieter</Label>
              <Input id="contract-new-vendor" name="vendor" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-category">Kategorie</Label>
              <Input
                id="contract-new-category"
                name="categoryLabel"
                placeholder="z. B. Cloud, Versicherung"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-interval">Intervall</Label>
              <Select name="billingInterval" defaultValue="monthly">
                <SelectTrigger id="contract-new-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContractBillingIntervalEnum).map((interval) => (
                    <SelectItem key={interval} value={interval}>
                      {BILLING_INTERVAL_LABELS[interval]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-amount">Betrag (€)</Label>
              <Input
                id="contract-new-amount"
                name="amountEuros"
                type="number"
                step="0.01"
                min={0}
                placeholder="z. B. 9,99"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-status">Status</Label>
              <Select name="status" defaultValue="active">
                <SelectTrigger id="contract-new-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ContractStatusEnum).map((status) => (
                    <SelectItem key={status} value={status}>
                      {CONTRACT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-next-payment">Nächste Zahlung</Label>
              <Input id="contract-new-next-payment" name="nextPaymentDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contract-new-cancel-by">Kündigen bis</Label>
              <Input id="contract-new-cancel-by" name="cancelByDate" type="date" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="contract-new-portal-url">Portal-Link</Label>
              <Input id="contract-new-portal-url" name="portalUrl" type="url" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="contract-new-notes">Notizen</Label>
              <Textarea id="contract-new-notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Vertrag anlegen</Button>
            </div>
          </form>
        </details>

        <Card>
          <CardHeader>
            <CardTitle>Kostenübersicht</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Monatlich (aktiv, inkl. KI-Schätzung): {formatEuroFromCents(costs.monthlyTotalCents)} ·
              Jährlich: {formatEuroFromCents(costs.yearlyTotalCents)} · Aktive Verträge:{" "}
              {costs.activeCount}
            </p>
            {alerts.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {alerts.map((alert) => (
                  <li
                    key={`${alert.contractId}-${alert.kind}`}
                    className="border-l-2 border-warning/60 pl-3"
                  >
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KI-Kosten (Schätzung)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Rollup aus <code>ai_usage_logs</code> — nur Cloud-Schätzungen (RTX = 0 USD). Keine
              Prompt-Inhalte.
            </p>
            <nav className="flex flex-wrap gap-2" aria-label="Zeitraum">
              {AI_PERIOD_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={`/contracts?period=${option.value}`}
                  aria-current={option.value === aiPeriod ? "page" : undefined}
                  className={buttonVariants({
                    variant: option.value === aiPeriod ? "default" : "secondary",
                    size: "sm",
                  })}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
            <p className="text-sm">
              Zeitraum: <strong>{aiRollup.periodLabel}</strong> · Anfragen: {aiRollup.requestCount} ·
              Tokens: {aiRollup.inputTokens + aiRollup.outputTokens} · Geschätzt:{" "}
              <strong>{formatUsdAmount(aiRollup.estimatedCostUsd)}</strong>
            </p>
            {aiSynced === "1" && (
              <p className="text-sm text-muted-foreground">
                KI-Monatskosten als Vertragseintrag übernommen.
              </p>
            )}
            {syncedAiContract && (
              <p className="text-sm text-muted-foreground">
                Verknüpfter Eintrag: {syncedAiContract.name} ·{" "}
                {formatEuroFromCents(syncedAiContract.amountCents ?? 0)} (EUR-Schätzung)
              </p>
            )}
            <form action={syncAiUsageContractAction}>
              <input type="hidden" name="period" value={aiPeriod} />
              <Button type="submit" variant="secondary" size="sm">
                Monatskosten als Vertragseintrag übernehmen
              </Button>
            </form>

            {aiRollup.byFeature.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold tracking-tight">Nach Feature</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH_CLASS}>Feature</th>
                        <th className={TH_CLASS}>Anfragen</th>
                        <th className={TH_CLASS}>Tokens</th>
                        <th className={TH_CLASS}>USD (Schätzung)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiRollup.byFeature.map((row) => (
                        <tr key={row.feature}>
                          <td className={TD_CLASS}>{row.feature}</td>
                          <td className={TD_CLASS}>{row.requestCount}</td>
                          <td className={TD_CLASS}>{row.inputTokens + row.outputTokens}</td>
                          <td className={TD_CLASS}>{formatUsdAmount(row.estimatedCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aiRollup.byUser.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold tracking-tight">Nach User</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={TH_CLASS}>User</th>
                        <th className={TH_CLASS}>Anfragen</th>
                        <th className={TH_CLASS}>Tokens</th>
                        <th className={TH_CLASS}>USD (Schätzung)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiRollup.byUser.map((row) => (
                        <tr key={row.userId ?? "system"}>
                          <td className={TD_CLASS}>{row.userDisplayName ?? "Unbekannt"}</td>
                          <td className={TD_CLASS}>{row.requestCount}</td>
                          <td className={TD_CLASS}>{row.inputTokens + row.outputTokens}</td>
                          <td className={TD_CLASS}>{formatUsdAmount(row.estimatedCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aiRollup.requestCount === 0 && (
              <p className="text-sm text-muted-foreground">
                Keine erfolgreichen KI-Aufrufe in diesem Zeitraum.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Detail-Logs und Budgets: <Link href="/admin/ai-gateway">AI Gateway (Owner)</Link>
            </p>
          </CardContent>
        </Card>

        {aiUsageContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>KI-Vertragseinträge (automatisch)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {aiUsageContracts.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.name}</strong> · {formatEuroFromCents(entry.amountCents ?? 0)} ·{" "}
                    {CONTRACT_STATUS_LABELS[entry.status]}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          <Link href="/today">← Heute</Link>
        </p>
      </div>
    </StudioShell>
  );
}
