import { requireOwner } from "@/src/lib/auth";
import {
  formatCriticDefect,
  loadCharacterCreatorProgress,
  resolveWorkstreamCriticVerdict,
  type CharacterCreatorContentCategory,
  type CharacterCreatorWorkstream,
  type WorkstreamCriticFile,
} from "@/src/lib/character-creator-progress";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/src/components/ui";

function statusBadgeVariant(
  status: string,
): "success" | "info" | "warning" | "danger" | "default" {
  switch (status.toLowerCase()) {
    case "completed":
    case "done":
      return "success";
    case "in_progress":
    case "partial":
      return "info";
    case "blocked":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

function statusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "Abgeschlossen";
    case "in_progress":
      return "In Arbeit";
    case "pending":
      return "Ausstehend";
    case "blocked":
      return "Blockiert";
    case "partial":
      return "Teilweise";
    default:
      return status;
  }
}

function verdictBadgeVariant(
  verdict: string | null,
): "success" | "danger" | "warning" | "default" {
  if (!verdict) {
    return "default";
  }
  switch (verdict.toUpperCase()) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "PENDING":
      return "warning";
    default:
      return "default";
  }
}

function verdictLabel(verdict: string | null): string {
  if (!verdict) {
    return "—";
  }
  switch (verdict.toUpperCase()) {
    case "APPROVED":
      return "Genehmigt";
    case "REJECTED":
      return "Abgelehnt";
    case "PENDING":
      return "Ausstehend";
    default:
      return verdict;
  }
}

function CountCell({ value }: { value: number }) {
  return <span className="tabular-nums">{value}</span>;
}

function WorkstreamRow({
  workstream,
  critic,
}: {
  workstream: CharacterCreatorWorkstream;
  critic: WorkstreamCriticFile | undefined;
}) {
  const criticVerdict = resolveWorkstreamCriticVerdict(workstream, critic);
  const criticDefects =
    critic?.defects.map((defect) => formatCriticDefect(defect)) ?? [];
  const openDefects = [...workstream.openDefects, ...criticDefects];

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="py-3 pr-4">
        <div className="font-medium">{workstream.name}</div>
        <div className="text-xs text-muted-foreground">{workstream.id}</div>
      </td>
      <td className="py-3 pr-4 text-sm">{workstream.agent}</td>
      <td className="py-3 pr-4">
        <Badge variant={statusBadgeVariant(workstream.status)}>
          {statusLabel(workstream.status)}
        </Badge>
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">
        <CountCell value={workstream.discoveredEntries} />
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">
        <CountCell value={workstream.importedEntries} />
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">
        <CountCell value={workstream.migratedEntries} />
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">
        <CountCell value={workstream.duplicates} />
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums">
        <CountCell value={workstream.blockedEntries} />
      </td>
      <td className="py-3 pr-4">
        <Badge variant={verdictBadgeVariant(criticVerdict)}>
          {verdictLabel(criticVerdict)}
        </Badge>
      </td>
      <td className="py-3 pr-4 text-sm">
        {openDefects.length > 0 ? (
          <ul className="list-disc pl-4">
            {openDefects.map((defect) => (
              <li key={defect}>{defect}</li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm">{workstream.nextAction}</td>
      <td className="py-3 text-sm text-muted-foreground">{workstream.lastUpdate}</td>
    </tr>
  );
}

function ContentCategoryRow({ category }: { category: CharacterCreatorContentCategory }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium">{category.type}</td>
      <td className="py-2 pr-4 tabular-nums">{category.discovered}</td>
      <td className="py-2 pr-4 tabular-nums">{category.imported}</td>
      <td className="py-2 pr-4 tabular-nums">{category.blocked}</td>
      <td className="py-2 pr-4 tabular-nums">{category.duplicates}</td>
      <td className="py-2">
        <Badge variant={statusBadgeVariant(category.status)}>
          {statusLabel(category.status)}
        </Badge>
      </td>
    </tr>
  );
}

export default async function CharacterCreatorProgressPage() {
  await requireOwner();

  const { progress, critics } = loadCharacterCreatorProgress();

  return (
    <>
      <ShellBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Charakter-Ersteller Fortschritt" },
        ]}
      />
      <PageHeader
        title="Charakter-Ersteller Fortschritt"
        summary="Live-Übersicht über Entwicklungs-Workstreams, Katalog-Import und Critic-Reviews — gelesen aus packages/character-creator/dev-progress/."
      />

      {!progress ? (
        <EmptyState
          title="Fortschrittsdaten nicht gefunden"
          description="progress.json konnte nicht geladen werden. Erwarteter Pfad: packages/character-creator/dev-progress/progress.json relativ zum Monorepo-Root."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
                <span>
                  Aktualisiert:{" "}
                  <strong className="text-foreground">{progress.updatedAt}</strong>
                </span>
                {progress.modelsPolicy ? (
                  <span>
                    Modelle:{" "}
                    <strong className="text-foreground">{progress.modelsPolicy}</strong>
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-muted-foreground">Entdeckt</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {progress.summary.discoveredEntries}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Importiert</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {progress.summary.importedEntries}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Migriert</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {progress.summary.migratedEntries}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Blockiert</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {progress.summary.blockedEntries}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inhaltskategorien</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">
                  Übersicht der Inhaltskategorien im Charakter-Ersteller-Import
                </caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Typ</th>
                    <th className="pb-2 pr-4 font-medium">Entdeckt</th>
                    <th className="pb-2 pr-4 font-medium">Importiert</th>
                    <th className="pb-2 pr-4 font-medium">Blockiert</th>
                    <th className="pb-2 pr-4 font-medium">Duplikate</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.contentCategories.map((category) => (
                    <ContentCategoryRow key={category.type} category={category} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workstreams</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <caption className="sr-only">
                  Entwicklungs-Workstreams für den Charakter-Ersteller
                </caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Workstream</th>
                    <th className="pb-2 pr-4 font-medium">Agent</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Entdeckt</th>
                    <th className="pb-2 pr-4 font-medium">Importiert</th>
                    <th className="pb-2 pr-4 font-medium">Migriert</th>
                    <th className="pb-2 pr-4 font-medium">Dupl.</th>
                    <th className="pb-2 pr-4 font-medium">Block.</th>
                    <th className="pb-2 pr-4 font-medium">Critic</th>
                    <th className="pb-2 pr-4 font-medium">Offene Mängel</th>
                    <th className="pb-2 pr-4 font-medium">Nächster Schritt</th>
                    <th className="pb-2 font-medium">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.workstreams.map((workstream) => (
                    <WorkstreamRow
                      key={workstream.id}
                      workstream={workstream}
                      critic={critics[workstream.id]}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Offene Mängel</CardTitle>
              </CardHeader>
              <CardContent>
                {progress.openDefects.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm">
                    {progress.openDefects.map((defect) => (
                      <li key={defect}>{defect}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine offenen Mängel.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fehlgeschlagene Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {progress.failedTests.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm">
                    {progress.failedTests.map((test) => (
                      <li key={test}>{test}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine fehlgeschlagenen Tests.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nächste Aktionen</CardTitle>
              </CardHeader>
              <CardContent>
                {progress.nextActions.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm">
                    {progress.nextActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine nächsten Aktionen.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Alert tone="info" title="Screenshots">
            {progress.screenshots.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {progress.screenshots.map((shot) => (
                  <li key={shot}>{shot}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">
                Noch keine Screenshots hinterlegt — die Liste kann anfangs leer sein, bis der
                a11y-/Visual-Workstream Bilder erzeugt.
              </p>
            )}
          </Alert>
        </div>
      )}
    </>
  );
}
