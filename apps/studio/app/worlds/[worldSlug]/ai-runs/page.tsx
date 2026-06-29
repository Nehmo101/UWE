import Link from "next/link";
import { notFound } from "next/navigation";
import { AI_TASK_LABELS } from "@uwe/ai-brain";
import {
  AI_RUN_STATUS_LABELS,
  createAiRunServiceFromClient,
  createPrismaClient,
  getAppRepository,
  type AiRunStatus,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { formatStudioDate } from "@/src/lib/format";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function AiRunsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { status: statusFilter } = await searchParams;

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const runsService = createAiRunServiceFromClient(db);
  const { runs, total } = await runsService.list({
    worldId: world.id,
    status: statusFilter as AiRunStatus | undefined,
    limit: 100,
  });
  await db.$disconnect();

  const statusFilters = [
    { label: "Alle", value: undefined },
    { label: "Abgeschlossen", value: "completed" },
    { label: "Fehlgeschlagen", value: "failed" },
    { label: "Übernommen", value: "applied" },
    { label: "Verworfen", value: "discarded" },
  ];
  const runsBase = `/worlds/${worldSlug}/ai-runs`;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "KI-Läufe", runsBase)}
        />
      }
      contextPanel={
        <CampaignSidebar
          title="Status"
          items={statusFilters.map((filter) => ({
            label: filter.label,
            href: filter.value ? `${runsBase}?status=${filter.value}` : runsBase,
            active: statusFilter === filter.value || (!statusFilter && !filter.value),
          }))}
        />
      }
    >
      <PageHeader
        title="AI Run History"
        summary={`${total} gespeicherte KI-Läufe. Ergebnisse sind Vorschläge — nichts wird automatisch als Kanon übernommen.`}
      />
      {runs.length === 0 ? (
        <p className="uwe-v2-empty">Noch keine AI Runs für diese Welt.</p>
      ) : (
        <table className="uwe-page-table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Aufgabe</th>
              <th>Status</th>
              <th>Provider / Modell</th>
              <th>Seite</th>
              <th>Dauer</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{formatStudioDate(run.createdAt, "short")}</td>
                <td>
                  {AI_TASK_LABELS[run.taskType as keyof typeof AI_TASK_LABELS] ?? run.taskType}
                </td>
                <td>{AI_RUN_STATUS_LABELS[run.status]}</td>
                <td>
                  {run.provider}
                  <br />
                  <span className="uwe-meta">{run.model}</span>
                </td>
                <td>{run.pageTitle ?? "—"}</td>
                <td>{run.durationMs != null ? `${run.durationMs} ms` : "—"}</td>
                <td>
                  <Link href={`/worlds/${worldSlug}/ai-runs/${run.id}`}>Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WorldShell>
  );
}
