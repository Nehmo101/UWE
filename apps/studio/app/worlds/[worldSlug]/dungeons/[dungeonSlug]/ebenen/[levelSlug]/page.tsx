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
import { createDungeonRoomAction } from "../../../../../../dungeon-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { dungeonBreadcrumb } from "@/src/lib/world-breadcrumbs";

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

  const dungeonHref = `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={dungeonBreadcrumb(world.name, worldSlug, [
            { label: overview.dungeon.title, href: dungeonHref },
            { label: overview.level.title },
          ])}
        />
      }
      contextPanel={
        <CampaignSidebar
          title="Räume"
          items={overview.rooms.map((room) => ({
            label: room.title,
            href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`,
          }))}
        />
      }
    >
      <PageHeader
        title={overview.level.title}
        summary={`Ebene in „${overview.dungeon.title}“`}
        meta={<DungeonPrepStatusBadge status={overview.level.prepStatus} />}
      />
      {created && <p className="uwe-flash uwe-flash-success">Raum erstellt.</p>}

      <section className="uwe-v2-section">
        <h2>Raum-Übersicht</h2>
        {overview.rooms.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine Räume auf dieser Ebene.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            {overview.rooms.map((room) => (
              <Link
                key={room.id}
                href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${levelSlug}/raeume/${room.slug}`}
                className="uwe-v2-card"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <strong>{room.title}</strong>
                <div style={{ marginTop: "0.35rem" }}>
                  <DungeonPrepStatusBadge status={room.prepStatus} />
                </div>
                {room.summary && (
                  <p className="uwe-hint" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                    {room.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="uwe-v2-section">
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
          <p className="uwe-v2-empty">Noch keine Räume auf dieser Ebene.</p>
        )}
      </section>

      <section className="uwe-v2-section">
        <h2>Neuer Raum</h2>
        <form action={createDungeonRoomAction} className="uwe-v2-form">
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

          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Raum anlegen</button>
        </form>
      </section>
    </WorldShell>
  );
}
