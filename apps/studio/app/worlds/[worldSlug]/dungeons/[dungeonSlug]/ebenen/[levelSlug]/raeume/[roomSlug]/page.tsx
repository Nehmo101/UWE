import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentBlockList,
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  PAGE_TYPE_LABELS,
  WikiContent,
} from "@uwe/shared-ui";
import { DungeonEntityList } from "@/components/DungeonEntityList";
import { AiContextPanel } from "@/components/AiContextPanel";
import { preparePrintListFromRoomAction } from "@/app/print-list-actions";
import { labelNewHref } from "@/src/lib/label-links";
import {
  buildWorldWikiIndex,
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
  ROOM_CHILD_TYPES,
} from "@uwe/database/server";
import {
  createRoomChildAction,
  linkAssetToDungeonPageAction,
  updateRoomContentAction,
} from "../../../../../../../../dungeon-actions";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { dungeonBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  buttonVariants,
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
  params: Promise<{
    worldSlug: string;
    dungeonSlug: string;
    levelSlug: string;
    roomSlug: string;
  }>;
  searchParams: Promise<{ created?: string; saved?: string; added?: string; assetLinked?: string }>;
}

const SECTION_CLASS = "mb-8 flex flex-col gap-3";
const FIELD_CLASS = "flex flex-col gap-1.5";
const HEADING_CLASS = "m-0 text-lg font-semibold tracking-tight";

export default async function StudioDungeonRoomPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug, levelSlug, roomSlug } = await params;
  const { created, saved, added, assetLinked } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const wikiIndex = await buildWorldWikiIndex(repo, worldSlug);
  const dungeons = createDungeonCockpitService();
  const cockpit = await dungeons.getRoomCockpit(
    worldSlug,
    dungeonSlug,
    levelSlug,
    roomSlug,
    wikiIndex,
  );
  if (!cockpit) notFound();

  const assets = await repo.listAssetsByWorld(worldSlug);
  const linkedAssetIds = new Set(cockpit.assets.map((a) => a.id));
  const linkableAssets = assets.filter((a) => !linkedAssetIds.has(a.id));
  const redirectTo = `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${roomSlug}`;
  const dungeonHref = `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;
  const levelHref = `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}`;

  const readAloud = cockpit.sections.readAloud.map((b) => b.content).join("\n\n");
  const playerDescription = cockpit.sections.playerDescription.map((b) => b.content).join("\n\n");
  const childPageIds = [
    ...cockpit.encounters,
    ...cockpit.traps,
    ...cockpit.puzzles,
    ...cockpit.loot,
    ...cockpit.secrets,
    ...cockpit.handouts,
    ...cockpit.maps,
  ].map((item) => item.id);
  const entitySections = [
    { title: "Encounters", items: cockpit.encounters, isSecretSection: false },
    { title: "Fallen", items: cockpit.traps, isSecretSection: false },
    { title: "Rätsel", items: cockpit.puzzles, isSecretSection: false },
    { title: "Loot", items: cockpit.loot, isSecretSection: false },
    { title: "Geheimnisse", items: cockpit.secrets, isSecretSection: true },
    { title: "Handouts", items: cockpit.handouts, isSecretSection: false },
    { title: "Karten", items: cockpit.maps, isSecretSection: false },
  ];
  const emptyEntitySections = entitySections
    .filter((section) => section.items.length === 0)
    .map((section) => section.title);

  return (
    <>
      <ShellBreadcrumb
        items={dungeonBreadcrumb(world.name, worldSlug, [
          { label: cockpit.dungeon.title, href: dungeonHref },
          { label: cockpit.level.title, href: levelHref },
          { label: cockpit.room.title },
        ])}
      />
      <ShellContextPanel>
        <CampaignSidebar
          items={[
            { label: cockpit.dungeon.title, href: dungeonHref },
            { label: cockpit.level.title, href: levelHref },
          ]}
        />
        <AiContextPanel
          kind="dungeon_room"
          worldSlug={worldSlug}
          pageSlug={roomSlug}
          dungeonSlug={dungeonSlug}
          levelSlug={levelSlug}
          roomSlug={roomSlug}
        />
      </ShellContextPanel>
      <PageHeader
        title={cockpit.room.title}
        summary={`${cockpit.level.title} · ${cockpit.dungeon.title}`}
        meta={<DungeonPrepStatusBadge status={cockpit.room.prepStatus} />}
        actions={
          <>
            <Link
              className={buttonVariants({ variant: "secondary" })}
              href={labelNewHref(worldSlug, "dungeon_room", cockpit.room.id)}
            >
              Label erstellen
            </Link>
            <form action={preparePrintListFromRoomAction}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="roomPageId" value={cockpit.room.id} />
              <input type="hidden" name="childPageIds" value={childPageIds.join(",")} />
              <input type="hidden" name="name" value={`${cockpit.room.title} — Druckliste`} />
              <input type="hidden" name="forNextSession" value="on" />
              <Button type="submit">Druckliste vorbereiten</Button>
            </form>
          </>
        }
      />
      {created && <Alert tone="success" className="mb-4">Raum erstellt.</Alert>}
      {saved && <Alert tone="success" className="mb-4">Raum gespeichert.</Alert>}
      {added && <Alert tone="success" className="mb-4">Eintrag hinzugefügt.</Alert>}
      {assetLinked && <Alert tone="success" className="mb-4">Asset verknüpft.</Alert>}

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Werkzeuge</h2>
        <p className="m-0 text-sm text-muted-foreground">
          Schnellzugriff für Beute und magische Gegenstände am Tisch.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={`/worlds/${worldSlug}/roll-tables`} className={buttonVariants({ variant: "secondary" })}>
            Zufallstabellen
          </Link>
          <Link href={`/worlds/${worldSlug}/magic-items`} className={buttonVariants({ variant: "secondary" })}>
            Magic-Item-Werkbank
          </Link>
        </div>
      </section>

      <form action={updateRoomContentAction} className="flex flex-col gap-4">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
        <input type="hidden" name="levelSlug" value={levelSlug} />
        <input type="hidden" name="roomSlug" value={roomSlug} />
        <input type="hidden" name="roomId" value={cockpit.room.id} />

        <div className={FIELD_CLASS}>
          <Label htmlFor="room-title">Titel</Label>
          <Input id="room-title" name="title" defaultValue={cockpit.room.title} required />
        </div>

        <div className={FIELD_CLASS}>
          <Label htmlFor="room-status">Status</Label>
          <Select name="prepStatus" defaultValue={cockpit.room.prepStatus ?? "unprepared"}>
            <SelectTrigger id="room-status">
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
          <Label htmlFor="room-read-aloud">Vorlesetext</Label>
          <Textarea id="room-read-aloud" name="readAloud" rows={4} defaultValue={readAloud} />
        </div>

        <div className={FIELD_CLASS}>
          <Label htmlFor="room-player-description">Spieler-sichtbare Beschreibung</Label>
          <Textarea
            id="room-player-description"
            name="playerDescription"
            rows={5}
            defaultValue={playerDescription}
          />
        </div>

        <div>
          <Button type="submit">Raum speichern</Button>
        </div>
      </form>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Wiki-Vorschau (mit Links)</h2>
        <WikiContent html={cockpit.html} />
      </section>

      {entitySections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <DungeonEntityList
            key={section.title}
            title={section.title}
            worldSlug={worldSlug}
            items={section.items}
            isSecretSection={section.isSecretSection}
          />
        ))}
      {emptyEntitySections.length > 0 && (
        <p className="my-4 text-sm italic text-muted-foreground">
          Noch keine Einträge: {emptyEntitySections.join(", ")}
        </p>
      )}

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Neuer Raum-Inhalt</h2>
        {ROOM_CHILD_TYPES.map((childType) => (
          <details key={childType} className="rounded-[var(--radius)] border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {PAGE_TYPE_LABELS[childType]} hinzufügen
            </summary>
            <form action={createRoomChildAction} className="mt-3 flex flex-col gap-4">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
              <input type="hidden" name="levelSlug" value={levelSlug} />
              <input type="hidden" name="roomSlug" value={roomSlug} />
              <input type="hidden" name="childType" value={childType} />
              <div className={FIELD_CLASS}>
                <Label htmlFor={`room-child-${childType}-title`}>Titel</Label>
                <Input id={`room-child-${childType}-title`} name="title" required />
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor={`room-child-${childType}-summary`}>Kurzbeschreibung</Label>
                <Input id={`room-child-${childType}-summary`} name="summary" />
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor={`room-child-${childType}-content`}>Inhalt</Label>
                <Textarea id={`room-child-${childType}-content`} name="content" rows={3} />
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor={`room-child-${childType}-status`}>Status</Label>
                <Select name="prepStatus" defaultValue="unprepared">
                  <SelectTrigger id={`room-child-${childType}-status`}>
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
              <div>
                <Button type="submit" variant="secondary">Anlegen</Button>
              </div>
            </form>
          </details>
        ))}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Assets &amp; Bilder</h2>
        {cockpit.assets.length > 0 && (
          <ul className="flex flex-col gap-2">
            {cockpit.assets.map((asset) => (
              <li key={asset.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  {asset.title} ({asset.type})
                </span>
                <Link
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  href={labelNewHref(worldSlug, "asset", asset.id)}
                >
                  Bild als Label
                </Link>
              </li>
            ))}
          </ul>
        )}
        {linkableAssets.length > 0 && (
          <form action={linkAssetToDungeonPageAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="pageId" value={cockpit.room.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className={FIELD_CLASS}>
              <Label htmlFor="room-link-asset">Asset verknüpfen</Label>
              {/* TODO(design-kit): natives select statt Kit-Select — Radix Select erlaubt
                  keinen leeren value="" für den Platzhalter "— wählen —". */}
              <select
                id="room-link-asset"
                name="assetId"
                required
                className="h-9 w-56 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— wählen —</option>
                {linkableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.title}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">Verknüpfen</Button>
          </form>
        )}
      </section>

      <section className={SECTION_CLASS}>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Alle ContentBlocks (Rohansicht)</summary>
          <div className="mt-3">
            <ContentBlockList
              blocks={[
                ...cockpit.sections.readAloud,
                ...cockpit.sections.playerDescription,
                ...cockpit.sections.otherBlocks,
              ].map((block) => ({
                id: block.id,
                type: block.type,
                sortOrder: block.sortOrder,
                content: block.content,
              }))}
            />
            <ul className="mt-3 flex flex-col gap-2">
              {[
                ...cockpit.sections.readAloud,
                ...cockpit.sections.playerDescription,
                ...cockpit.sections.otherBlocks,
              ].map((block) => (
                <li key={`label-${block.id}`}>
                  <Link
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    href={labelNewHref(worldSlug, "content_block", block.id)}
                  >
                    Block → Label ({block.type})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </section>
    </>
  );
}
