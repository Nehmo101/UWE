import { SidebarSection } from "@uwe/shared-ui";
import {
  createJobService,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  prisma,
} from "@uwe/database/server";
import { JobsWorkspace } from "@/components/JobsWorkspace";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

export default async function JobsPage() {
  const jobs = createJobService(prisma);
  const [jobList, summary] = await Promise.all([jobs.list({ limit: 100 }), jobs.getSummary()]);

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Jobs" }]} />}
      contextPanel={
        <SidebarSection title="Hinweise">
          <ul className="uwe-hint" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={{ marginBottom: "0.5rem" }}>
              Fehlgeschlagene Jobs können erneut versucht werden, wenn der Typ Retry unterstützt.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              Laufende KI- und Mail-Jobs blockieren andere Studio-Aktionen nicht.
            </li>
            <li>Restore-Jobs werden aus Sicherheitsgründen nicht automatisch wiederholt.</li>
          </ul>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Job-Warteschlange"
        summary="Mail, KI, Embeddings, Import und Backup laufen als Hintergrund-Jobs — die UI bleibt reaktionsfähig."
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
