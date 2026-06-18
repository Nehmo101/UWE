import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
} from "@uwe/database/server";
import { createDungeonRoomAction } from "../../../../../../dungeon-actions";

interface Props {
  params: Promise<{ worldSlug: string; dungeonSlug: string; levelSlug: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function StudioDungeonLevelPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug, levelSlug } = await params;
  const { created } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const dungeons = createDungeonCockpitService();
  const overview = await dungeons.getLevelOverview(worldSlug, dungeonSlug, levelSlug);
  if (!overview) notFound();

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={overview.level.title} href="/studio" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dungeon", href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}` },
              ...overview.rooms.map((room) => ({
                label: room.title,
                href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`,
              })),
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Dungeons", href: `/worlds/${worldSlug}/dungeons` },
              { label: overview.dungeon.title, href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}` },
              { label: overview.level.title },
            ]}
          />

          {created && <p className="uwe-flash uwe-flash-success">Raum erstellt.</p>}

          <PageHeader
            title={overview.level.title}
            summary={`Ebene in „${overview.dungeon.title}"`}
            meta={<DungeonPrepStatusBadge status={overview.level.prepStatus} />}
          />

          <section className="uwe-section">
            <h2>Räume</h2>
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Raum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      <Link
                        href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`}
                      >
                        {room.title}
                      </Link>
                    </td>
                    <td><DungeonPrepStatusBadge status={room.prepStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overview.rooms.length === 0 && (
              <p className="uwe-empty">Noch keine Räume auf dieser Ebene.</p>
            )}
          </section>

          <section className="uwe-section">
            <h2>Neuer Raum</h2>
            <form action={createDungeonRoomAction} className="uwe-form">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
              <input type="hidden" name="levelSlug" value={levelSlug} />

              <label>
                Titel
                <input name="title" required placeholder="Raum A — Vorhalle" />
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

              <label>
                Vorlesetext (Spieler)
                <textarea name="readAloud" rows={3} placeholder="Ihr betretet einen staubigen Saal…" />
              </label>

              <label>
                Spieler-sichtbare Beschreibung
                <textarea name="playerDescription" rows={4} placeholder="Was die Spieler sehen…" />
              </label>

              <label>
                DM-Notizen
                <textarea name="dmNotes" rows={4} placeholder="Geheime Hinweise, DCs, Trigger…" />
              </label>

              <button type="submit" className="uwe-btn uwe-btn-primary">Raum anlegen</button>
            </form>
          </section>
        </>
      }
    />
  );
}
