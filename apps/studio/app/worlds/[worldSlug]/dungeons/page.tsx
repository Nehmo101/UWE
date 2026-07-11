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
import { buttonVariants, Card, CardContent, EmptyState } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; status?: string }>;
}

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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
          <Link className={buttonVariants({ variant: "default" })} href={`/worlds/${worldSlug}/dungeons/new`}>
            Neuer Dungeon
          </Link>
        }
      />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Status-Filter">
        <Link
          href={`/worlds/${worldSlug}/dungeons${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}
          className={buttonVariants({ variant: !statusFilter ? "default" : "outline", size: "sm" })}
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
              className={buttonVariants({ variant: statusFilter === status ? "default" : "outline", size: "sm" })}
            >
              {DUNGEON_PREP_STATUS_LABELS[status]}
            </Link>
          );
        })}
      </nav>

      {filteredDungeons.length === 0 ? (
        <EmptyState
          title="Noch keine Dungeons"
          description="Erstelle den ersten Dungeon für diese Welt."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Titel</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Zusammenfassung</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDungeons.map((dungeon) => (
                    <tr key={dungeon.id}>
                      <td className={TD_CLASS}>
                        <Link href={`/worlds/${worldSlug}/dungeons/${dungeon.slug}`}>
                          {dungeon.title}
                        </Link>
                      </td>
                      <td className={TD_CLASS}>
                        <DungeonPrepStatusBadge status={dungeon.prepStatus} />
                      </td>
                      <td className={TD_CLASS}>{dungeon.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </WorldShell>
  );
}
