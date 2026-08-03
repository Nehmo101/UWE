import Link from "next/link";
import { notFound } from "next/navigation";
import { SidebarSection } from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { BackupWorkspace } from "@/components/BackupWorkspace";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
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
    <>
      <ShellBreadcrumb items={worldSectionBreadcrumb(world.name, worldSlug, "Backup", `/worlds/${worldSlug}/backup`)} />
      <ShellContextPanel>
        {/*
          Hier stand die Kampagnen-Filterliste mit `/worlds/<slug>` als Basis —
          die Welt-Wurzel leitet auf das Cockpit um und wirft `?campaign=` dabei
          weg. Jeder Eintrag führte also aus dem Backup heraus, ohne zu filtern.
          Was die Seite wirklich braucht, ist der Slug: das Formular „Kampagne"
          verlangt ihn als Freitext.
        */}
        <SidebarSection title="Kampagnen-Slugs">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Diese Welt hat noch keine Kampagne.</p>
          ) : (
            <ul className="flex list-none flex-col gap-1 p-0 text-sm">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="flex min-w-0 flex-col">
                  <span className="truncate">{campaign.name}</span>
                  <code className="text-xs text-muted-foreground">{campaign.slug}</code>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/worlds/${worldSlug}/campaigns`} className="mt-2 inline-block text-xs">
            Kampagnen verwalten
          </Link>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title={`Backup — ${world.name}`}
        summary="Welt- und Kampagnen-Backups für diese Welt erstellen, herunterladen und wiederherstellen."
      />
      <BackupWorkspace initialBackups={backups} defaultWorldSlug={worldSlug} />
    </>
  );
}
