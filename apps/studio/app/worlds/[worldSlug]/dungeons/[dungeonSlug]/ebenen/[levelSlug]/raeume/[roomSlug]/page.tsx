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
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { dungeonBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{
    worldSlug: string;
    dungeonSlug: string;
    levelSlug: string;
    roomSlug: string;
  }>;
  searchParams: Promise<{ created?: string; saved?: string; added?: string; assetLinked?: string }>;
}

export default async function StudioDungeonRoomPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug, levelSlug, roomSlug } = await params;
  const { created, saved, added, assetLinked } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const wikiIndex = await buildWorldWikiIndex(repo, worldSlug, "dm");
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
  const dmNotes = cockpit.sections.dmNotes.map((b) => b.content).join("\n\n");
  const childPageIds = [
    ...cockpit.encounters,
    ...cockpit.traps,
    ...cockpit.puzzles,
    ...cockpit.loot,
    ...cockpit.secrets,
    ...cockpit.handouts,
    ...cockpit.maps,
  ].map((item) => item.id);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={dungeonBreadcrumb(world.name, worldSlug, [
            { label: cockpit.dungeon.title, href: dungeonHref },
            { label: cockpit.level.title, href: levelHref },
            { label: cockpit.room.title },
          ])}
        />
      }
      contextPanel={
        <>
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
        </>
      }
    >
      <PageHeader
        title={cockpit.room.title}
        summary={`${cockpit.level.title} · ${cockpit.dungeon.title}`}
        meta={<DungeonPrepStatusBadge status={cockpit.room.prepStatus} />}
        actions={
          <>
            <Link
              className="uwe-v2-btn"
              href={labelNewHref(worldSlug, "dungeon_room", cockpit.room.id)}
            >
              Label erstellen
            </Link>
            <form action={preparePrintListFromRoomAction} style={{ display: "inline" }}>
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="roomPageId" value={cockpit.room.id} />
              <input type="hidden" name="childPageIds" value={childPageIds.join(",")} />
              <input type="hidden" name="name" value={`${cockpit.room.title} — Druckliste`} />
              <input type="hidden" name="forNextSession" value="on" />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
                Druckliste vorbereiten
              </button>
            </form>
          </>
        }
      />
      {created && <p className="uwe-flash uwe-flash-success">Raum erstellt.</p>}
      {saved && <p className="uwe-flash uwe-flash-success">Raum gespeichert.</p>}
      {added && <p className="uwe-flash uwe-flash-success">Eintrag hinzugefügt.</p>}
      {assetLinked && <p className="uwe-flash uwe-flash-success">Asset verknüpft.</p>}

      <section className="uwe-v2-section">
        <h2>Werkzeuge</h2>
        <p className="uwe-hint">Schnellzugriff für Beute und magische Gegenstände am Tisch.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href={`/worlds/${worldSlug}/roll-tables`} className="uwe-v2-btn">
            Zufallstabellen
          </Link>
          <Link href={`/worlds/${worldSlug}/magic-items`} className="uwe-v2-btn">
            Magic-Item-Werkbank
          </Link>
        </div>
      </section>

      <form action={updateRoomContentAction} className="uwe-edit-form">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
        <input type="hidden" name="levelSlug" value={levelSlug} />
        <input type="hidden" name="roomSlug" value={roomSlug} />
        <input type="hidden" name="roomId" value={cockpit.room.id} />

        <label>
          Titel
          <input name="title" defaultValue={cockpit.room.title} required />
        </label>

        <label>
          Status
          <select name="prepStatus" defaultValue={cockpit.room.prepStatus ?? "unprepared"}>
            {Object.values(DungeonPrepStatusEnum).map((status) => (
              <option key={status} value={status}>
                {DUNGEON_PREP_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Vorlesetext
          <textarea name="readAloud" rows={4} defaultValue={readAloud} />
        </label>

        <label>
          Spieler-sichtbare Beschreibung
          <textarea name="playerDescription" rows={5} defaultValue={playerDescription} />
        </label>

        <label>
          DM-Notizen
          <textarea name="dmNotes" rows={5} defaultValue={dmNotes} />
        </label>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Raum speichern</button>
      </form>

      <section className="uwe-v2-section">
        <h2>Wiki-Vorschau (mit Links)</h2>
        <WikiContent html={cockpit.html} />
      </section>

      <DungeonEntityList title="Encounters" worldSlug={worldSlug} items={cockpit.encounters} />
      <DungeonEntityList title="Fallen" worldSlug={worldSlug} items={cockpit.traps} />
      <DungeonEntityList title="Rätsel" worldSlug={worldSlug} items={cockpit.puzzles} />
      <DungeonEntityList title="Loot" worldSlug={worldSlug} items={cockpit.loot} />
      <DungeonEntityList
        title="Geheimnisse"
        worldSlug={worldSlug}
        items={cockpit.secrets}
        isSecretSection
      />
      <DungeonEntityList title="Handouts" worldSlug={worldSlug} items={cockpit.handouts} />
      <DungeonEntityList title="Karten" worldSlug={worldSlug} items={cockpit.maps} />

      <section className="uwe-v2-section">
        <h2>Neuer Raum-Inhalt</h2>
        {ROOM_CHILD_TYPES.map((childType) => (
          <details key={childType} style={{ marginBottom: "1rem" }}>
            <summary>{PAGE_TYPE_LABELS[childType]} hinzufügen</summary>
            <form action={createRoomChildAction} className="uwe-v2-form">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
              <input type="hidden" name="levelSlug" value={levelSlug} />
              <input type="hidden" name="roomSlug" value={roomSlug} />
              <input type="hidden" name="childType" value={childType} />
              <label>
                Titel
                <input name="title" required />
              </label>
              <label>
                Kurzbeschreibung
                <input name="summary" />
              </label>
              <label>
                Inhalt
                <textarea name="content" rows={3} />
              </label>
              <label>
                Status
                <select name="prepStatus" defaultValue="unprepared">
                  {Object.values(DungeonPrepStatusEnum).map((status) => (
                    <option key={status} value={status}>
                      {DUNGEON_PREP_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="uwe-v2-btn">Anlegen</button>
            </form>
          </details>
        ))}
      </section>

      <section className="uwe-v2-section">
        <h2>Assets &amp; Bilder</h2>
        {cockpit.assets.length > 0 && (
          <ul>
            {cockpit.assets.map((asset) => (
              <li key={asset.id}>
                {asset.title} ({asset.type}){" "}
                <Link
                  className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                  href={labelNewHref(worldSlug, "asset", asset.id)}
                >
                  Bild als Label
                </Link>
              </li>
            ))}
          </ul>
        )}
        {linkableAssets.length > 0 && (
          <form action={linkAssetToDungeonPageAction} className="uwe-v2-form uwe-form-inline">
            <input type="hidden" name="pageId" value={cockpit.room.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label>
              Asset verknüpfen
              <select name="assetId" required>
                <option value="">— wählen —</option>
                {linkableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.title}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="uwe-v2-btn">Verknüpfen</button>
          </form>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2>Alle ContentBlocks</h2>
        <ContentBlockList
          blocks={[
            ...cockpit.sections.readAloud,
            ...cockpit.sections.playerDescription,
            ...cockpit.sections.dmNotes,
            ...cockpit.sections.otherBlocks,
          ].map((block) => ({
            id: block.id,
            type: block.type,
            sortOrder: block.sortOrder,
            content: block.content,
            visibility: block.visibility,
          }))}
          showVisibility
        />
        <ul className="uwe-linked-list" style={{ marginTop: "0.75rem" }}>
          {[
            ...cockpit.sections.readAloud,
            ...cockpit.sections.playerDescription,
            ...cockpit.sections.dmNotes,
            ...cockpit.sections.otherBlocks,
          ].map((block) => (
            <li key={`label-${block.id}`}>
              <Link
                className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                href={labelNewHref(worldSlug, "content_block", block.id)}
              >
                Block → Label ({block.type})
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </WorldShell>
  );
}
