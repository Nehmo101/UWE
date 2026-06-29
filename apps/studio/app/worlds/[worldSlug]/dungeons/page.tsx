import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DungeonPrepStatusBadge,
} from "@uwe/shared-ui";
import {
  createDungeonCockpitService,
  getAppRepository,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function StudioDungeonsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const dungeons = createDungeonCockpitService();
  const dungeonList = await dungeons.listDungeons(
    worldSlug,
    selectedCampaign?.id ? { campaignId: selectedCampaign.id } : undefined,
  );

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Dungeons", `/worlds/${worldSlug}/dungeons`)}
        />
      }
      contextPanel={
        <CampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}/dungeons`, campaigns, campaignSlug)}
        />
      }
    >
      <PageHeader
        title="Dungeon Cockpit"
        summary="Dungeons, Ebenen und Räume strukturiert vorbereiten — mit Vorlesetext, GM-Notizen und zugeordneten Assets."
        actions={
          <Link className="uwe-v2-btn uwe-v2-btn-primary" href={`/worlds/${worldSlug}/dungeons/new`}>
            Neuer Dungeon
          </Link>
        }
      />
      <table className="uwe-page-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Status</th>
            <th>Zusammenfassung</th>
          </tr>
        </thead>
        <tbody>
          {dungeonList.map((dungeon) => (
            <tr key={dungeon.id}>
              <td>
                <Link href={`/worlds/${worldSlug}/dungeons/${dungeon.slug}`}>
                  {dungeon.title}
                </Link>
              </td>
              <td><DungeonPrepStatusBadge status={dungeon.prepStatus} /></td>
              <td>{dungeon.summary ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {dungeonList.length === 0 && (
        <p className="uwe-v2-empty">Noch keine Dungeons. Erstelle den ersten Dungeon für diese Welt.</p>
      )}
    </WorldShell>
  );
}
