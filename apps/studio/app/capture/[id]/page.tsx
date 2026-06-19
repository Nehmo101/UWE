import { notFound } from "next/navigation";
import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createCaptureTriageService,
  createLifeAdminService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { CaptureTriagePanel } from "@/components/capture/CaptureTriagePanel";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CaptureDetailPage({ params }: Props) {
  const { id } = await params;
  const lifeAdmin = createLifeAdminService(prisma);
  const capture = await lifeAdmin.getCapture(id);

  if (!capture) {
    notFound();
  }

  await createCaptureTriageService(prisma).ensureAiProposal(capture.id);

  const refreshed = (await lifeAdmin.getCapture(id))!;
  const repo = getAppRepository();
  const worlds = await repo.listWorlds();
  const hardwareDevices = await lifeAdmin.listHardwareDevices({ limit: 100 });

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("capture")}
      contextTitle="Capture Triage"
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Capture Triage" href="/capture" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/capture")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Capture sortieren"
            summary="Vorschlag prüfen und in Projekte, Werkstatt, DnD, Hardware, Verträge oder Life Brain überführen."
          />
          <CaptureTriagePanel
            capture={refreshed}
            worlds={worlds.map((world) => ({
              id: world.id,
              slug: world.slug,
              name: world.name,
            }))}
            hardwareDevices={hardwareDevices}
          />
        </>
      }
    />
  );
}
