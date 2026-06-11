import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  ASSET_TYPE_LABELS,
  AssetTypeBadge,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  VisibilityBadge,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  type AssetType,
} from "@uwe/database/server";
import { ASSET_TYPES } from "@uwe/assets";
import { linkAssetToPageAction } from "@/app/asset-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ type?: string; uploaded?: string; linked?: string; saved?: string }>;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default async function StudioAssetsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type: typeFilter, uploaded, linked, saved } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const assets = await repo.listAssetsByWorld(worldSlug, {
    type: typeFilter as AssetType | undefined,
  });
  const pages = await repo.listPagesByWorld(worldSlug);

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />}
      sidebar={
        <>
          <SidebarSection title="Welt">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/" },
                { label: "Seiten", href: `/worlds/${worldSlug}` },
                { label: "Assets", href: `/worlds/${worldSlug}/assets`, active: true },
                { label: "Neue Seite", href: `/worlds/${worldSlug}/pages/new` },
              ]}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Assets" },
            ]}
          />
          <PageHeader
            title="Asset-Bibliothek"
            summary="Bilder, Karten, Handouts und Medien zentral verwalten."
          />

          {(uploaded || linked || saved) && (
            <p className="uwe-flash uwe-flash-success">Änderungen gespeichert.</p>
          )}

          <section className="uwe-panel">
            <h2>Asset hochladen</h2>
            <form
              className="uwe-form-grid"
              action={`/api/worlds/${worldSlug}/assets/upload`}
              method="post"
              encType="multipart/form-data"
            >
              <label>
                Datei
                <input type="file" name="file" required />
              </label>
              <label>
                Titel
                <input type="text" name="title" placeholder="Anzeigename" />
              </label>
              <label>
                Beschreibung
                <textarea name="description" rows={2} />
              </label>
              <label>
                Typ
                <select name="type" defaultValue="">
                  <option value="">Automatisch erkennen</option>
                  {ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ASSET_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue="dm_only">
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Seite zuordnen (optional)
                <select name="pageId" defaultValue="">
                  <option value="">— Keine —</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="uwe-btn uwe-btn-primary">
                Hochladen
              </button>
            </form>
          </section>

          <div className="uwe-filter-bar">
            <Link
              href={`/worlds/${worldSlug}/assets`}
              className={!typeFilter ? "active" : undefined}
            >
              Alle Typen
            </Link>
            {ASSET_TYPES.map((type) => (
              <Link
                key={type}
                href={`/worlds/${worldSlug}/assets?type=${type}`}
                className={typeFilter === type ? "active" : undefined}
              >
                {ASSET_TYPE_LABELS[type]}
              </Link>
            ))}
          </div>

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Größe</th>
                <th>Seiten</th>
                <th>Vorschau</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <strong>{asset.title}</strong>
                    {asset.description && (
                      <p className="uwe-table-sub">{asset.description}</p>
                    )}
                  </td>
                  <td>
                    <AssetTypeBadge type={asset.type} />
                  </td>
                  <td>
                    <VisibilityBadge visibility={asset.visibility} />
                  </td>
                  <td>{formatBytes(asset.size)}</td>
                  <td>
                    {asset.pageLinks.length > 0
                      ? asset.pageLinks.map((link) => link.page.title).join(", ")
                      : "—"}
                  </td>
                  <td>
                    {isPreviewable(asset.mimeType) ? (
                      <a
                        className="uwe-link"
                        href={`/api/assets/${asset.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Öffnen
                      </a>
                    ) : (
                      <a
                        className="uwe-link"
                        href={`/api/assets/${asset.id}/file`}
                        download
                      >
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {assets.length === 0 && (
            <p className="uwe-empty">Noch keine Assets für diesen Filter.</p>
          )}

          {assets.length > 0 && pages.length > 0 && (
            <section className="uwe-panel">
              <h2>Asset einer Seite zuordnen</h2>
              <form action={linkAssetToPageAction} className="uwe-form-grid">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <label>
                  Asset
                  <select name="assetId" required>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Seite
                  <select name="pageId" required>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="uwe-btn">
                  Verknüpfen
                </button>
              </form>
            </section>
          )}
        </>
      }
      context={
        <SidebarSection title="Kontext">
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
            {assets.length} Assets
          </p>
        </SidebarSection>
      }
    />
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
