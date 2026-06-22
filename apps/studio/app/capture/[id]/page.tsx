import { notFound } from "next/navigation";
import {
  createCaptureTriageService,
  createLifeAdminService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { CaptureTriagePanel } from "@/components/capture/CaptureTriagePanel";
import { AdminModuleShell } from "@/components/AdminModuleShell";

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
    <AdminModuleShell
      activePath="/capture"
      title="Capture sortieren"
      summary="Vorschlag prüfen und in Projekte, Werkstatt, DnD, Hardware, Verträge oder Life Brain überführen."
      bottomNav="capture"
    >
      <CaptureTriagePanel
            capture={refreshed}
            worlds={worlds.map((world) => ({
              id: world.id,
              slug: world.slug,
              name: world.name,
            }))}
            hardwareDevices={hardwareDevices}
          />
    </AdminModuleShell>
  );
}
