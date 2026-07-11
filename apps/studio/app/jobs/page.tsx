import { SidebarSection } from "@uwe/shared-ui";
import {
  CAMPAIGN_JOB_PRESETS,
  createJobService,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  prisma,
} from "@uwe/database/server";
import { CampaignJobPresetsPanel } from "@/components/CampaignJobPresetsPanel";
import { JobsWorkspace } from "@/components/JobsWorkspace";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";

export default async function JobsPage() {
  await requireStudioAccess();
  const jobs = createJobService(prisma);
  const rawJobs = await jobs.list({ limit: 100 });
  const jobList = rawJobs.filter((job) => job.type !== "agent_job");
  const [summary, worlds, sessions] = await Promise.all([
    jobs.getSummary(),
    prisma.world.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.gameSession.findMany({
      where: {
        status: { in: ["planned", "prepared", "played", "summarized"] },
      },
      select: {
        id: true,
        title: true,
        sessionNumber: true,
        world: { select: { slug: true } },
      },
      orderBy: [{ worldId: "asc" }, { sessionNumber: "desc" }],
      take: 200,
    }),
  ]);

  const sessionsByWorld: Record<
    string,
    Array<{ id: string; title: string; sessionNumber: number }>
  > = {};

  for (const session of sessions) {
    const slug = session.world.slug;
    if (!sessionsByWorld[slug]) {
      sessionsByWorld[slug] = [];
    }
    sessionsByWorld[slug].push({
      id: session.id,
      title: session.title,
      sessionNumber: session.sessionNumber,
    });
  }

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Jobs" }]} />}
      contextPanel={
        <SidebarSection title="Hinweise">
          <ul className="flex list-none flex-col gap-2 text-sm text-muted-foreground">
            <li>
              Kampagnen-Presets starten Kanonprüfung, Brain-Aktionen und Reindex mit einem Klick.
            </li>
            <li>
              Fehlgeschlagene Jobs können erneut versucht werden, wenn der Typ Retry unterstützt.
            </li>
            <li>Restore-Jobs werden aus Sicherheitsgründen nicht automatisch wiederholt.</li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Job-Warteschlange"
        summary="System-Jobs (Mail, KI, Import, Backup). Cursor/GitHub-Agent-Verwaltung: /admin/agent-jobs."
      />

      <CampaignJobPresetsPanel
        presets={JSON.parse(JSON.stringify(CAMPAIGN_JOB_PRESETS))}
        worlds={worlds}
        sessionsByWorld={sessionsByWorld}
      />

      <JobsWorkspace
        initialJobs={JSON.parse(JSON.stringify(jobList))}
        initialSummary={summary}
        typeLabels={JOB_TYPE_LABELS}
        statusLabels={JOB_STATUS_LABELS}
      />
    </StudioShell>
  );
}
