import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
} from "@uwe/shared-ui";
import {
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; status?: string }>;
}

function parsePrepStatus(raw: string | undefined) {
  if (raw && Object.values(DungeonPrepStatusEnum).includes(raw as (typeof DungeonPrepStatusEnum)[keyof typeof DungeonPrepStatusEnum])) {
    return raw as (typeof DungeonPrepStatusEnum)[keyof typeof DungeonPrepStatusEnum];
  }
  return undefined;
}

export default async function StudioDungeonsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, status: statusRaw } = await searchParams;
  const statusFilter = parsePrepStatus(statusRaw);
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
  const filteredDungeons = statusFilter
    ? dungeonList.filter((dungeon) => dungeon.prepStatus === statusFilter)
    : dungeonList;

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
      <nav className="uwe-today-quick-chips uwe-v2-section" aria-label="Status-Filter">
        <Link
          href={`/worlds/${worldSlug}/dungeons${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}
          className="uwe-today-quick-chip"
          data-severity={!statusFilter ? "warn" : "info"}
        >
          Alle
        </Link>
        {Object.values(DungeonPrepStatusEnum).map((status) => {
          const paramsObj = new URLSearchParams();
          if (campaignSlug) paramsObj.set("campaign", campaignSlug);
          paramsObj.set("status", status);
          return (
            <Link
              key={status}
              href={`/worlds/${worldSlug}/dungeons?${paramsObj}`}
              className="uwe-today-quick-chip"
              data-severity={statusFilter === status ? "warn" : "info"}
            >
              {DUNGEON_PREP_STATUS_LABELS[status]}
            </Link>
          );
        })}
      </nav>
      <table className="uwe-page-table">
        <thead>
          <tr>
            <th>Titel</th>
            <th>Status</th>
            <th>Zusammenfassung</th>
          </tr>
        </thead>
        <tbody>
          {filteredDungeons.map((dungeon) => (
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

      {filteredDungeons.length === 0 && (
        <p className="uwe-v2-empty">Noch keine Dungeons. Erstelle den ersten Dungeon für diese Welt.</p>
      )}
    </WorldShell>
  );
}
