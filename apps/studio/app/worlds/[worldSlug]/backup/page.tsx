import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { getAppRepository } from "@uwe/database/server";
import { listStoredBackups } from "@uwe/backup";
import { BackupWorkspace } from "@/components/BackupWorkspace";

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
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/studio" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/studio" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Assets", href: `/worlds/${worldSlug}/assets` },
                { label: "Backup", href: `/worlds/${worldSlug}/backup`, active: true },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Kampagnen">
            <SidebarNav
              items={campaigns.map((campaign) => ({
                label: campaign.name,
                href: `/worlds/${worldSlug}?campaign=${campaign.slug}`,
              }))}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Backup" },
            ]}
          />
          <PageHeader
            title={`Backup — ${world.name}`}
            summary="Welt- und Kampagnen-Backups für diese Welt erstellen, herunterladen und wiederherstellen."
          />
          <BackupWorkspace initialBackups={backups} defaultWorldSlug={worldSlug} />
        </>
      }
    />
  );
}
