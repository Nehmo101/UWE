import Link from "next/link";
import { notFound } from "next/navigation";
import { ASSET_TYPE_LABELS, AssetTypeBadge, VisibilityBadge } from "@uwe/shared-ui";
import { ASSET_TYPES } from "@uwe/assets";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import type { AssetType } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ type?: string }>;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export default async function AuthWorldAssetsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type: typeFilter } = await searchParams;
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let assets;
  try {
    assets = await auth.listAssetsForViewer(worldSlug, ctx, {
      type: typeFilter,
    });
  } finally {
    await db.$disconnect();
  }

  return (
    <section className="portal-content-card">
      <h1>Handouts & Medien</h1>
      <p className="auth-lead">
        Medien und Handouts, die für deine Rolle ({ctx.effectiveRole}) sichtbar sind.
      </p>

      <div className="uwe-filter-bar">
        <Link
          href={`/auth/worlds/${worldSlug}/assets`}
          className={!typeFilter ? "active" : undefined}
        >
          Alle Typen
        </Link>
        {ASSET_TYPES.map((type) => (
          <Link
            key={type}
            href={`/auth/worlds/${worldSlug}/assets?type=${type}`}
            className={typeFilter === type ? "active" : undefined}
          >
            {ASSET_TYPE_LABELS[type as AssetType]}
          </Link>
        ))}
      </div>

      <ul className="auth-asset-list">
        {assets.map((asset) => (
          <li key={asset.id} className="auth-asset-item">
            <div className="auth-asset-meta">
              <strong>{asset.title}</strong>
              <div className="auth-asset-badges">
                <AssetTypeBadge type={asset.type} />
                <VisibilityBadge visibility={asset.visibility} />
              </div>
              {asset.description && <p>{asset.description}</p>}
            </div>
            <div className="auth-asset-preview">
              {isPreviewable(asset.mimeType) ? (
                asset.mimeType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                    alt={asset.title}
                    className="auth-asset-thumb"
                  />
                ) : (
                  <iframe
                    src={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                    title={asset.title}
                    className="auth-asset-thumb"
                  />
                )
              ) : (
                <a
                  href={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                  className="uwe-link"
                >
                  {asset.mimeType ?? "Datei"} herunterladen
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {assets.length === 0 && <p>Für deine Rolle sind derzeit keine Assets freigegeben.</p>}
    </section>
  );
}
