import Link from "next/link";
import { notFound } from "next/navigation";
import { ASSET_TYPE_LABELS, AssetTypeBadge, VisibilityBadge } from "@uwe/shared-ui";
import { ASSET_TYPES } from "@uwe/assets";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PortalEmptyState } from "@/src/components/PortalEmptyState";
import { PageHeader } from "@/src/components/shell";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
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
    <>
      <PageHeader
        title="Handouts & Medien"
        summary={`Medien und Handouts, die für deine Rolle (${ctx.effectiveRole}) sichtbar sind.`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/auth/worlds/${worldSlug}/assets`}
          className={cn(
            buttonVariants({ variant: !typeFilter ? "default" : "outline", size: "sm" }),
          )}
        >
          Alle Typen
        </Link>
        {ASSET_TYPES.map((type) => (
          <Link
            key={type}
            href={`/auth/worlds/${worldSlug}/assets?type=${type}`}
            className={cn(
              buttonVariants({ variant: typeFilter === type ? "default" : "outline", size: "sm" }),
            )}
          >
            {ASSET_TYPE_LABELS[type as AssetType]}
          </Link>
        ))}
      </div>

      <ul className="grid gap-3">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="grid gap-4 rounded-[var(--radius)] border border-border p-4 sm:grid-cols-[1fr_min(100%,280px)]"
          >
            <div className="min-w-0 space-y-2">
              <strong>{asset.title}</strong>
              <div className="flex flex-wrap gap-2">
                <AssetTypeBadge type={asset.type} />
                <VisibilityBadge visibility={asset.visibility} />
              </div>
              {asset.description ? <p className="text-sm text-muted-foreground">{asset.description}</p> : null}
            </div>
            <div className="overflow-hidden rounded-[var(--radius)] border border-border">
              {isPreviewable(asset.mimeType) ? (
                asset.mimeType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                    alt={asset.title}
                    className="h-auto max-h-48 w-full object-contain"
                  />
                ) : (
                  <iframe
                    src={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                    title={asset.title}
                    className="h-48 w-full"
                  />
                )
              ) : (
                <a
                  href={`/api/assets/${asset.id}/file?world=${encodeURIComponent(worldSlug)}`}
                  className="flex h-24 items-center justify-center p-4 text-sm text-primary hover:underline"
                >
                  {asset.mimeType ?? "Datei"} herunterladen
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {assets.length === 0 ? (
        <PortalEmptyState title="Keine Assets freigegeben" icon="image" />
      ) : null}
    </>
  );
}
