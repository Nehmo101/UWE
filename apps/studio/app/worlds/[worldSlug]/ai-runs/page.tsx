import { notFound } from "next/navigation";
import { AI_TASK_LABELS } from "@uwe/ai-brain";
import {
  AI_RUN_STATUS_LABELS,
  createAiRunServiceFromClient,
  createPrismaClient,
  getAppRepository,
  type AiRunStatus,
} from "@uwe/database/server";
import { AiRunsTable } from "@/components/AiRunsTable";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

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
    { label: "Ausstehend", value: "pending" },
    { label: "Läuft", value: "running" },
    { label: "Abgeschlossen", value: "completed" },
    { label: "Fehlgeschlagen", value: "failed" },
    { label: "Übernommen", value: "applied" },
    { label: "Verworfen", value: "discarded" },
  ];
  const runsBase = `/worlds/${worldSlug}/ai-runs`;

  const serializedRuns = runs.map((run) => ({
    id: run.id,
    taskType: run.taskType,
    status: run.status,
    provider: run.provider,
    model: run.model,
    pageTitle: run.pageTitle,
    durationMs: run.durationMs,
    createdAt: run.createdAt.toISOString(),
  }));

  return (
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "KI-Läufe", runsBase)} />
      <ShellContextPanel>
        <CampaignSidebar
          title="Status"
          items={statusFilters.map((filter) => ({
            label: filter.label,
            href: filter.value ? `${runsBase}?status=${filter.value}` : runsBase,
            active: statusFilter === filter.value || (!statusFilter && !filter.value),
          }))}
        />
      </ShellContextPanel>
      <PageHeader
        title="AI Run History"
        summary={`${total} gespeicherte KI-Läufe. Ergebnisse sind Vorschläge — nichts wird automatisch als Kanon übernommen. Laufende Jobs aktualisieren sich automatisch.`}
      />
      <AiRunsTable
        worldSlug={worldSlug}
        initialRuns={serializedRuns}
        taskLabels={AI_TASK_LABELS as Record<string, string>}
        statusLabels={AI_RUN_STATUS_LABELS as Record<string, string>}
      />
    </>
  );
}
