import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  ContentBlockList,
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  PageHeader,
  PAGE_TYPE_LABELS,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  WikiContent,
} from "@uwe/shared-ui";
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

interface Props {
  params: Promise<{
    worldSlug: string;
    dungeonSlug: string;
    levelSlug: string;
    roomSlug: string;
  }>;
  searchParams: Promise<{ created?: string; saved?: string; added?: string; assetLinked?: string }>;
}

function EntityList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; prepStatus: import("@uwe/database/enums").DungeonPrepStatus | null }>;
}) {
  if (items.length === 0) {
    return (
      <section className="uwe-section">
        <h3>{title}</h3>
        <p className="uwe-empty">Keine Einträge.</p>
      </section>
    );
  }

  return (
    <section className="uwe-section">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} — <DungeonPrepStatusBadge status={item.prepStatus} />
          </li>
        ))}
      </ul>
    </section>
  );
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

  const readAloud = cockpit.sections.readAloud.map((b) => b.content).join("\n\n");
  const playerDescription = cockpit.sections.playerDescription.map((b) => b.content).join("\n\n");
  const dmNotes = cockpit.sections.dmNotes.map((b) => b.content).join("\n\n");

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={cockpit.room.title} href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              {
                label: "← Ebene",
                href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}`,
              },
              { label: cockpit.dungeon.title, href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Dungeons", href: `/worlds/${worldSlug}/dungeons` },
              { label: cockpit.dungeon.title, href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}` },
              {
                label: cockpit.level.title,
                href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}`,
              },
              { label: cockpit.room.title },
            ]}
          />

          {created && <p className="uwe-flash uwe-flash-success">Raum erstellt.</p>}
          {saved && <p className="uwe-flash uwe-flash-success">Raum gespeichert.</p>}
          {added && <p className="uwe-flash uwe-flash-success">Eintrag hinzugefügt.</p>}
          {assetLinked && <p className="uwe-flash uwe-flash-success">Asset verknüpft.</p>}

          <PageHeader
            title={cockpit.room.title}
            summary={`${cockpit.level.title} · ${cockpit.dungeon.title}`}
            meta={<DungeonPrepStatusBadge status={cockpit.room.prepStatus} />}
          />

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

            <button type="submit" className="uwe-btn uwe-btn-primary">Raum speichern</button>
          </form>

          <section className="uwe-section">
            <h2>Wiki-Vorschau (mit Links)</h2>
            <WikiContent html={cockpit.html} />
          </section>

          <EntityList title="Encounters" items={cockpit.encounters} />
          <EntityList title="Fallen" items={cockpit.traps} />
          <EntityList title="Rätsel" items={cockpit.puzzles} />
          <EntityList title="Loot" items={cockpit.loot} />
          <EntityList title="Geheimnisse" items={cockpit.secrets} />
          <EntityList title="Handouts" items={cockpit.handouts} />
          <EntityList title="Karten" items={cockpit.maps} />

          <section className="uwe-section">
            <h2>Neuer Raum-Inhalt</h2>
            {ROOM_CHILD_TYPES.map((childType) => (
              <details key={childType} style={{ marginBottom: "1rem" }}>
                <summary>{PAGE_TYPE_LABELS[childType]} hinzufügen</summary>
                <form action={createRoomChildAction} className="uwe-form">
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
                  <button type="submit" className="uwe-btn">Anlegen</button>
                </form>
              </details>
            ))}
          </section>

          <section className="uwe-section">
            <h2>Assets &amp; Bilder</h2>
            {cockpit.assets.length > 0 && (
              <ul>
                {cockpit.assets.map((asset) => (
                  <li key={asset.id}>{asset.title} ({asset.type})</li>
                ))}
              </ul>
            )}
            {linkableAssets.length > 0 && (
              <form action={linkAssetToDungeonPageAction} className="uwe-form uwe-form-inline">
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
                <button type="submit" className="uwe-btn">Verknüpfen</button>
              </form>
            )}
          </section>

          <section className="uwe-section">
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
          </section>
        </>
      }
    />
  );
}
