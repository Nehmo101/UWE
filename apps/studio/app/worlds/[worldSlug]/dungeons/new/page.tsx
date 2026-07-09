import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DungeonQuickStartPresets } from "@/src/components/dungeon/DungeonQuickStartPresets";
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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Dungeons",
            `/worlds/${worldSlug}/dungeons`,
            "Neuer Dungeon",
          )}
        />
      }
    >
      <PageHeader
        title="Neuer Dungeon"
        summary="Dungeon mit Ebenen und Räumen anlegen."
      />
      <DungeonQuickStartPresets formId="new-dungeon-form" />
      <form id="new-dungeon-form" action={createDungeonAction} className="uwe-v2-form">
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
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Dungeon erstellen</button>
          <Link className="uwe-v2-btn" href={`/worlds/${worldSlug}/dungeons`}>Abbrechen</Link>
        </div>
      </form>
    </WorldShell>
  );
}
