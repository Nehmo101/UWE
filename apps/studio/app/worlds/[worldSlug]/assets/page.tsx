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
  createPrismaClient,
  createShareLinkService,
  type AssetType,
  type ShareTargetType,
} from "@uwe/database/server";
import { ShareLinkPanel } from "@/components/ShareLinkPanel";
import { getShareLinkPublicUrl } from "@/src/lib/share-url";
import { ASSET_TYPES } from "@uwe/assets";
import { linkAssetToPageAction, updateAssetAction } from "@/app/asset-actions";

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

  const db = createPrismaClient();
  const shareService = createShareLinkService(db);
  const assetShareData = await Promise.all(
    assets.map(async (asset) => {
      const targetType: ShareTargetType = asset.type === "handout" ? "handout" : "asset";
      const links = await shareService.listShareLinksForTarget(world.id, targetType, asset.id);
      const activeLink = links.find((link) => link.enabled);
      return {
        assetId: asset.id,
        targetType,
        links: links.map((link) => ({
          id: link.id,
          token: link.token,
          enabled: link.enabled,
          expiresAt: link.expiresAt?.toISOString() ?? null,
          readOnly: link.readOnly,
          logAccess: link.logAccess,
          hasPassword: Boolean(link.passwordHash),
          createdAt: link.createdAt.toISOString(),
        })),
        previewHref: activeLink ? getShareLinkPublicUrl(activeLink.token) : undefined,
      };
    }),
  );
  await db.$disconnect();

  const shareByAssetId = new Map(assetShareData.map((item) => [item.assetId, item]));

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
                { label: "Labels", href: `/worlds/${worldSlug}/labels` },
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
                <th>Label</th>
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
                  <td>
                    {asset.mimeType?.startsWith("image/") ? (
                      <a
                        className="uwe-link"
                        href={`/worlds/${worldSlug}/labels/new?sourceRef=asset:${asset.id}`}
                      >
                        Als Label
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {assets.length === 0 && (
            <p className="uwe-empty">Noch keine Assets für diesen Filter.</p>
          )}

          {assets.length > 0 && (
            <section className="uwe-panel">
              <h2>Asset bearbeiten</h2>
              {assets.map((asset) => (
                <details key={asset.id} className="share-asset-details">
                  <summary>{asset.title}</summary>
                  <form action={updateAssetAction} className="uwe-form-grid">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="assetId" value={asset.id} />
                    <label>
                      Titel
                      <input type="text" name="title" defaultValue={asset.title} required />
                    </label>
                    <label>
                      Beschreibung
                      <textarea name="description" rows={2} defaultValue={asset.description ?? ""} />
                    </label>
                    <label>
                      Typ
                      <select name="type" defaultValue={asset.type}>
                        {ASSET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {ASSET_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Sichtbarkeit
                      <select name="visibility" defaultValue={asset.visibility}>
                        {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="uwe-btn uwe-btn-primary">
                      Speichern
                    </button>
                  </form>
                </details>
              ))}
            </section>
          )}

          {assets.length > 0 && (
            <section className="uwe-panel">
              <h2>Freigabe-Links</h2>
              {assets.map((asset) => {
                const share = shareByAssetId.get(asset.id);
                if (!share) return null;
                return (
                  <details key={asset.id} className="share-asset-details">
                    <summary>{asset.title}</summary>
                    <ShareLinkPanel
                      worldId={world.id}
                      worldSlug={worldSlug}
                      targetType={share.targetType}
                      targetId={asset.id}
                      returnPath={`/worlds/${worldSlug}/assets`}
                      links={share.links}
                      previewHref={share.previewHref}
                    />
                  </details>
                );
              })}
            </section>
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
          <p className="uwe-hint" style={{ margin: 0 }}>
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
