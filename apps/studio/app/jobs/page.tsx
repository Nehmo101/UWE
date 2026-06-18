import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createJobService,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  prisma,
} from "@uwe/database/server";
import { JobsWorkspace } from "@/components/JobsWorkspace";

export default async function JobsPage() {
  const jobs = createJobService(prisma);
  const [jobList, summary] = await Promise.all([jobs.list({ limit: 100 }), jobs.getSummary()]);

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Hintergrund-Jobs" href="/studio" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/studio" },
              { label: "Jobs", href: "/jobs", active: true },
              { label: "Backup", href: "/backup" },
              { label: "Einstellungen", href: "/settings" },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb items={[{ label: "Dashboard", href: "/studio" }, { label: "Jobs" }]} />
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
        </>
      }
      context={
        <SidebarSection title="Hinweise">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
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
    />
  );
}
