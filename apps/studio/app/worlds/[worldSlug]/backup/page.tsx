import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { BackupWorkspace } from "@/components/BackupWorkspace";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { listStudioBackups } from "@/src/lib/backup-paths";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function WorldBackupPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const backups = (await listStudioBackups()).filter(
    (backup) =>
      backup.manifest.worldSlug === worldSlug ||
      backup.manifest.type === "full",
  );

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Backup", `/worlds/${worldSlug}/backup`)}
        />
      }
      contextPanel={
        <CampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}`, campaigns)}
        />
      }
    >
      <PageHeader
        title={`Backup — ${world.name}`}
        summary="Welt- und Kampagnen-Backups für diese Welt erstellen, herunterladen und wiederherstellen."
      />
      <BackupWorkspace initialBackups={backups} defaultWorldSlug={worldSlug} />
    </WorldShell>
  );
}
