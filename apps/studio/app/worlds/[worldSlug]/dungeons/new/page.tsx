import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { WorldModuleShell } from "@/components/WorldModuleShell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { createDungeonAction } from "../../../../dungeon-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string }>;
}

export default async function NewDungeonPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : campaigns[0];

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="dungeons"
      backLink={{ label: "← Dungeons", href: `/worlds/${worldSlug}/dungeons` }}
      breadcrumb={worldDetailBreadcrumb(
        world.name,
        worldSlug,
        "Dungeons",
        `/worlds/${worldSlug}/dungeons`,
        "Neuer Dungeon",
      )}
      pageHeader={{
        title: "Neuer Dungeon",
        summary: "Dungeon mit Ebenen und Räumen anlegen.",
      }}
      showSearch={false}
    >
      <form action={createDungeonAction} className="uwe-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        {selectedCampaign && (
          <input type="hidden" name="campaignId" value={selectedCampaign.id} />
        )}

        <label>
          Titel
          <input name="title" required placeholder="Verlassener Tempel" />
        </label>

        <label>
          Zusammenfassung
          <textarea name="summary" rows={2} placeholder="Kurzbeschreibung für die Übersicht" />
        </label>

        <label>
          Beschreibung (DM)
          <textarea name="description" rows={6} placeholder="Dungeon-Überblick mit [[Wiki-Links]]…" />
        </label>

        <div className="uwe-form-actions">
          <button type="submit" className="uwe-btn uwe-btn-primary">Dungeon erstellen</button>
          <Link className="uwe-btn" href={`/worlds/${worldSlug}/dungeons`}>Abbrechen</Link>
        </div>
      </form>
    </WorldModuleShell>
  );
}
