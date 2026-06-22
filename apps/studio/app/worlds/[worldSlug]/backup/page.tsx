import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { listStoredBackups } from "@uwe/backup";
import { BackupWorkspace } from "@/components/BackupWorkspace";
import { WorldCampaignSidebar, WorldModuleShell } from "@/components/WorldModuleShell";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function WorldBackupPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const backups = listStoredBackups().filter(
    (backup) =>
      backup.manifest.worldSlug === worldSlug ||
      backup.manifest.type === "full",
  );

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="backup"
      breadcrumb={worldSectionBreadcrumb(world.name, worldSlug, "Backup", `/worlds/${worldSlug}/backup`)}
      pageHeader={{
        title: `Backup — ${world.name}`,
        summary: "Welt- und Kampagnen-Backups für diese Welt erstellen, herunterladen und wiederherstellen.",
      }}
      sidebarExtra={
        <WorldCampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}`, campaigns)}
        />
      }
    >
      <BackupWorkspace initialBackups={backups} defaultWorldSlug={worldSlug} />
    </WorldModuleShell>
  );
}
