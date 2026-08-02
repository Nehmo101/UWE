import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppRepository } from "@uwe/database/server";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DungeonQuickStartPresets } from "@/src/components/dungeon/DungeonQuickStartPresets";
import { createDungeonAction } from "../../../../dungeon-actions";
import { Button, buttonVariants, Input, Label, Textarea } from "@/src/components/ui";

const FIELD_CLASS = "flex flex-col gap-1.5";

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
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          "Dungeons",
          `/worlds/${worldSlug}/dungeons`,
          "Neuer Dungeon",
        )}
      />
      <PageHeader
        title="Neuer Dungeon"
        summary="Dungeon mit Ebenen und Räumen anlegen."
      />
      <DungeonQuickStartPresets formId="new-dungeon-form" />
      <form id="new-dungeon-form" action={createDungeonAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        {selectedCampaign && (
          <input type="hidden" name="campaignId" value={selectedCampaign.id} />
        )}

        <div className={FIELD_CLASS}>
          <Label htmlFor="new-dungeon-title">Titel</Label>
          <Input id="new-dungeon-title" name="title" required placeholder="Verlassener Tempel" />
        </div>

        <div className={FIELD_CLASS}>
          <Label htmlFor="new-dungeon-summary">Zusammenfassung</Label>
          <Textarea
            id="new-dungeon-summary"
            name="summary"
            rows={2}
            placeholder="Kurzbeschreibung für die Übersicht"
          />
        </div>

        <div className={FIELD_CLASS}>
          <Label htmlFor="new-dungeon-description">Beschreibung (DM)</Label>
          <Textarea
            id="new-dungeon-description"
            name="description"
            rows={6}
            placeholder="Dungeon-Überblick mit [[Wiki-Links]]…"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Dungeon erstellen</Button>
          <Link className={buttonVariants({ variant: "outline" })} href={`/worlds/${worldSlug}/dungeons`}>
            Abbrechen
          </Link>
        </div>
      </form>
    </>
  );
}
