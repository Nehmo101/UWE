import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  PageHeader,
  PUBLISH_LABELS,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  WikiContent,
} from "@uwe/shared-ui";
import {
  buildWorldWikiIndex,
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
  PublishStatusEnum,
  VisibilityEnum,
} from "@uwe/database/server";
import {
  createDungeonLevelAction,
  linkAssetToDungeonPageAction,
  updateDungeonEntityAction,
} from "../../../../dungeon-actions";

interface Props {
  params: Promise<{ worldSlug: string; dungeonSlug: string }>;
  searchParams: Promise<{ saved?: string; assetLinked?: string }>;
}

export default async function StudioDungeonDetailPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug } = await params;
  const { saved, assetLinked } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const wikiIndex = await buildWorldWikiIndex(repo, worldSlug, "dm");
  const dungeons = createDungeonCockpitService();
  const overview = await dungeons.getDungeonOverview(worldSlug, dungeonSlug, wikiIndex);
  if (!overview) notFound();

  const assets = await repo.listAssetsByWorld(worldSlug);
  const linkedAssetIds = new Set(overview.assets.map((a) => a.id));
  const linkableAssets = assets.filter((a) => !linkedAssetIds.has(a.id));
  const redirectTo = `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={overview.dungeon.title} href="/" />}
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Dungeons", href: `/worlds/${worldSlug}/dungeons` },
              ...overview.levels.map((level) => ({
                label: level.title,
                href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`,
              })),
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
              { label: overview.dungeon.title },
            ]}
          />

          {saved && <p className="uwe-flash uwe-flash-success">Dungeon gespeichert.</p>}
          {assetLinked && <p className="uwe-flash uwe-flash-success">Asset verknüpft.</p>}

          <PageHeader
            title={overview.dungeon.title}
            summary={overview.dungeon.summary ?? undefined}
            meta={<DungeonPrepStatusBadge status={overview.dungeon.prepStatus} />}
          />

          <section className="uwe-section">
            <h2>Ebenen</h2>
            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>Ebene</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.levels.map((level) => (
                  <tr key={level.id}>
                    <td>
                      <Link href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`}>
                        {level.title}
                      </Link>
                    </td>
                    <td><DungeonPrepStatusBadge status={level.prepStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overview.levels.length === 0 && (
              <p className="uwe-empty">Noch keine Ebenen.</p>
            )}
          </section>

          <section className="uwe-section">
            <h2>Neue Ebene</h2>
            <form action={createDungeonLevelAction} className="uwe-form uwe-form-inline">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
              <label>
                Titel
                <input name="title" required placeholder="Ebene 1 — Eingangshalle" />
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
              <button type="submit" className="uwe-btn uwe-btn-primary">Ebene anlegen</button>
            </form>
          </section>

          <section className="uwe-section">
            <h2>Beschreibung</h2>
            <WikiContent html={overview.html} />
          </section>

          <section className="uwe-section">
            <h2>Assets &amp; Karten</h2>
            {overview.assets.length > 0 && (
              <ul>
                {overview.assets.map((asset) => (
                  <li key={asset.id}>{asset.title} ({asset.type})</li>
                ))}
              </ul>
            )}
            {linkableAssets.length > 0 && (
              <form action={linkAssetToDungeonPageAction} className="uwe-form uwe-form-inline">
                <input type="hidden" name="pageId" value={overview.dungeon.id} />
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
            <h2>Metadaten</h2>
            <form action={updateDungeonEntityAction} className="uwe-edit-form">
              <input type="hidden" name="pageId" value={overview.dungeon.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label>
                Titel
                <input name="title" defaultValue={overview.dungeon.title} required />
              </label>
              <label>
                Zusammenfassung
                <textarea name="summary" rows={2} defaultValue={overview.dungeon.summary ?? ""} />
              </label>
              <label>
                Status
                <select name="prepStatus" defaultValue={overview.dungeon.prepStatus ?? "unprepared"}>
                  {Object.values(DungeonPrepStatusEnum).map((status) => (
                    <option key={status} value={status}>
                      {DUNGEON_PREP_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue={overview.dungeon.visibility}>
                  {Object.values(VisibilityEnum).map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              </label>
              <label>
                Publish
                <select name="publishStatus" defaultValue={overview.dungeon.publishStatus}>
                  {Object.values(PublishStatusEnum).map((s) => (
                    <option key={s} value={s}>{PUBLISH_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">Speichern</button>
            </form>
          </section>
        </>
      }
    />
  );
}
