import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  WikiContent,
} from "@uwe/shared-ui";
import {
  buildWorldWikiIndex,
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
import { createDungeonRoomAction } from "../../../../../../dungeon-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { DungeonSidePages } from "@/src/components/dungeon/DungeonSidePages";
import { CampaignSidebar } from "@/src/components/wiki";
import { dungeonBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; dungeonSlug: string; levelSlug: string }>;
  searchParams: Promise<{ created?: string }>;
}

const SECTION_CLASS = "mb-8 flex flex-col gap-3";
const FIELD_CLASS = "flex flex-col gap-1.5";
const HEADING_CLASS = "m-0 text-lg font-semibold tracking-tight";

export default async function StudioDungeonLevelPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug, levelSlug } = await params;
  const { created } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const wikiIndex = await buildWorldWikiIndex(repo, worldSlug);
  const dungeons = createDungeonCockpitService();
  const overview = await dungeons.getLevelOverview(worldSlug, dungeonSlug, levelSlug, wikiIndex);
  if (!overview) notFound();

  const dungeonHref = `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;

  return (
    <>
      <ShellBreadcrumb
        items={dungeonBreadcrumb(world.name, worldSlug, [
          { label: overview.dungeon.title, href: dungeonHref },
          { label: overview.level.title },
        ])}
      />
      <ShellContextPanel>
        <CampaignSidebar
          title="Räume"
          items={overview.rooms.map((room) => ({
            label: room.title,
            href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`,
          }))}
        />
      </ShellContextPanel>
      <PageHeader
        title={overview.level.title}
        summary={`Ebene in „${overview.dungeon.title}“`}
        meta={<DungeonPrepStatusBadge status={overview.level.prepStatus} />}
      />
      {created && <Alert tone="success" className="mb-4">Raum erstellt.</Alert>}

      {overview.html.trim() !== "" && (
        <section className={SECTION_CLASS}>
          <h2 className={HEADING_CLASS}>Ebenentext</h2>
          <WikiContent html={overview.html} />
        </section>
      )}

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Raum-Übersicht</h2>
        {overview.rooms.length === 0 ? (
          <EmptyState title="Noch keine Räume auf dieser Ebene" />
        ) : (
          <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-3">
            {overview.rooms.map((room) => (
              <Link
                key={room.id}
                href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`}
                className="block rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <strong>{room.title}</strong>
                <div className="mt-1.5">
                  <DungeonPrepStatusBadge status={room.prepStatus} />
                </div>
                {room.summary && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{room.summary}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <DungeonSidePages
        worldSlug={worldSlug}
        pages={overview.extras}
        title="Begegnungen, Rätsel, Beute"
        emptyHint="Nichts weiter an dieser Ebene"
      />

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Neuer Raum</h2>
        <form action={createDungeonRoomAction} className="flex flex-col gap-4">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
          <input type="hidden" name="levelSlug" value={levelSlug} />

          <div className={FIELD_CLASS}>
            <Label htmlFor="new-room-title">Titel</Label>
            <Input id="new-room-title" name="title" required placeholder="Raum A — Vorhalle" />
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="new-room-status">Status</Label>
            <Select name="prepStatus" defaultValue="unprepared">
              <SelectTrigger id="new-room-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DungeonPrepStatusEnum).map((status) => (
                  <SelectItem key={status} value={status}>
                    {DUNGEON_PREP_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="new-room-read-aloud">Vorlesetext (Spieler)</Label>
            <Textarea
              id="new-room-read-aloud"
              name="readAloud"
              rows={3}
              placeholder="Ihr betretet einen staubigen Saal…"
            />
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="new-room-player-description">Spieler-sichtbare Beschreibung</Label>
            <Textarea
              id="new-room-player-description"
              name="playerDescription"
              rows={4}
              placeholder="Was die Spieler sehen…"
            />
          </div>

          <div>
            <Button type="submit">Raum anlegen</Button>
          </div>
        </form>
      </section>
    </>
  );
}
