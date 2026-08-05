import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import {
  CAMPAIGN_JOB_PRESETS,
  createJobService,
  getAppRepository,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  prisma,
} from "@uwe/database/server";
import { CampaignJobPresetsPanel } from "@/components/CampaignJobPresetsPanel";
import { JobsWorkspace } from "@/components/JobsWorkspace";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Hintergrund-Jobs dieser Welt.
 *
 * Die Warteschlange stand global unter „Automatisierung", obwohl fast jeder
 * Job eine `worldSlug` trägt und dort ausgelöst wurde, wo man gerade arbeitet.
 * Liste, Zählwerk und Presets sind hier auf die Welt eingegrenzt; Jobs ohne
 * Welt (Backup, Mail-Sync) bleiben Sache des Betriebs und tauchen hier bewusst
 * nicht auf.
 */
export default async function WorldJobsPage({ params }: Props) {
  const { worldSlug } = await params;
  await requireStudioAccess();

  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const jobs = createJobService(prisma);
  const [jobList, summary, sessions] = await Promise.all([
    jobs.list({ limit: 100, worldSlug }),
    jobs.getSummary({ worldSlug }),
    prisma.gameSession.findMany({
      where: {
        worldId: world.id,
        status: { in: ["planned", "prepared", "played", "summarized"] },
      },
      select: { id: true, title: true, sessionNumber: true },
      orderBy: { sessionNumber: "desc" },
      take: 200,
    }),
  ]);

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Hintergrund-Jobs",
          `/worlds/${worldSlug}/jobs`,
        )}
      />
      <ShellContextPanel>
        <SidebarSection title="Hinweise">
          <ul className="flex list-none flex-col gap-2 text-sm text-muted-foreground">
            <li>
              Diese Liste zeigt nur Jobs von <strong>{world.name}</strong>. Job-Arten ohne Welt
              (Backup, Mail-Sync) laufen über den Betrieb.
            </li>
            <li>
              Kampagnen-Presets starten Kanonprüfung, Brain-Aktionen und Reindex mit einem Klick.
            </li>
            <li>
              Fehlgeschlagene Jobs können erneut versucht werden, wenn der Typ Retry unterstützt.
            </li>
            <li>Restore-Jobs werden aus Sicherheitsgründen nicht automatisch wiederholt.</li>
          </ul>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Hintergrund-Jobs"
        summary={`Job-Warteschlange von ${world.name} (KI, Import, Kanonprüfung).`}
      />

      <CampaignJobPresetsPanel
        presets={JSON.parse(JSON.stringify(CAMPAIGN_JOB_PRESETS))}
        worlds={[{ id: world.id, name: world.name, slug: world.slug }]}
        sessionsByWorld={{ [worldSlug]: sessions }}
      />

      <JobsWorkspace
        initialJobs={JSON.parse(JSON.stringify(jobList))}
        initialSummary={summary}
        typeLabels={JOB_TYPE_LABELS}
        statusLabels={JOB_STATUS_LABELS}
        worldSlug={worldSlug}
      />
    </>
  );
}
