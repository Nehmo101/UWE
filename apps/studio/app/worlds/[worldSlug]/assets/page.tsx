import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ASSET_TYPE_LABELS,
  AssetTypeBadge,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  createAssetAlbumService,
  createPrismaClient,
  parseStringArray,
  type AssetType,
} from "@uwe/database/server";
import { ASSET_TYPES } from "@uwe/assets";
import {
  createAssetAlbumAction,
  linkAssetToPageAction,
  openAssetInImageStudioAction,
  updateAssetAction,
} from "@/app/asset-actions";
import { AssetBatchToolbar, AssetTagProposalPanel } from "@/components/assets/AssetBatchToolbar";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
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
  badgeVariants,
  cn,
  EmptyState,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    type?: string;
    uploaded?: string;
    linked?: string;
    saved?: string;
    tagged?: string;
    album?: string;
  }>;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const FILTER_LINK_CLASS = cn(
  "px-3 py-1 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

export default async function StudioAssetsPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type: typeFilter, uploaded, linked, saved, tagged, album: albumFilter } =
    await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const albumService = createAssetAlbumService(db);
  const albums = await albumService.listAlbumsByWorld(world.id);
  const albumAssetIds = albumFilter
    ? new Set(await albumService.listAssetIdsInAlbum(albumFilter))
    : null;

  const assets = (await repo.listAssetsByWorld(worldSlug, {
    type: typeFilter as AssetType | undefined,
  }))
    .filter((asset) => !albumAssetIds || albumAssetIds.has(asset.id));
  const pages = await repo.listPagesByWorld(worldSlug);
  await db.$disconnect();


  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Medien & Assets", `/worlds/${worldSlug}/assets`)}
        />
      }
      contextPanel={
        <SidebarSection title="Kontext">
          <p className="text-sm text-muted-foreground">{assets.length} Assets</p>
        </SidebarSection>
      }
    >
      <PageHeader
        title="Asset-Bibliothek"
        summary="Bilder, Karten, Handouts und Medien zentral verwalten."
      />

      <div className="flex flex-col gap-6">
        {(uploaded || linked || saved || tagged) && <Alert tone="success">Änderungen gespeichert.</Alert>}
        <nav className="flex flex-wrap gap-2" aria-label="Asset-Typ">
          <Link
            href={`/worlds/${worldSlug}/assets`}
            aria-current={!typeFilter ? "page" : undefined}
            className={cn(badgeVariants({ variant: !typeFilter ? "accent" : "default" }), FILTER_LINK_CLASS)}
          >
            Alle Typen
          </Link>
          {ASSET_TYPES.map((type) => (
            <Link
              key={type}
              href={`/worlds/${worldSlug}/assets?type=${type}`}
              aria-current={typeFilter === type ? "page" : undefined}
              className={cn(badgeVariants({ variant: typeFilter === type ? "accent" : "default" }), FILTER_LINK_CLASS)}
            >
              {ASSET_TYPE_LABELS[type]}
            </Link>
          ))}
        </nav>

        {albums.length > 0 && (
          <nav className="flex flex-wrap gap-2" aria-label="Album">
            <Link
              href={`/worlds/${worldSlug}/assets`}
              aria-current={!albumFilter ? "page" : undefined}
              className={cn(badgeVariants({ variant: !albumFilter ? "accent" : "default" }), FILTER_LINK_CLASS)}
            >
              Alle Assets
            </Link>
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/worlds/${worldSlug}/assets?album=${album.id}`}
                aria-current={albumFilter === album.id ? "page" : undefined}
                className={cn(badgeVariants({ variant: albumFilter === album.id ? "accent" : "default" }), FILTER_LINK_CLASS)}
              >
                {album.title} ({album._count.items})
              </Link>
            ))}
          </nav>
        )}

        {assets.length > 0 ? (
          <ul className="grid gap-2">
            {assets.map((asset) => {
              const metadata =
                asset.metadata &&
                typeof asset.metadata === "object" &&
                !Array.isArray(asset.metadata)
                  ? (asset.metadata as Record<string, unknown>)
                  : {};
              const proposal = metadata.aiTagProposal;
              const proposedTags =
                proposal &&
                typeof proposal === "object" &&
                !Array.isArray(proposal) &&
                Array.isArray((proposal as Record<string, unknown>).tags)
                  ? ((proposal as Record<string, unknown>).tags as unknown[]).filter(
                      (entry): entry is string => typeof entry === "string",
                    )
                  : [];

              return (
                <li
                  key={asset.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{asset.title}</strong>
                    <AssetTypeBadge type={asset.type} />
                    <span className="text-sm text-muted-foreground">{formatBytes(asset.size)}</span>
                  </div>
                  {asset.description && <p className="text-sm">{asset.description}</p>}
                  {asset.pageLinks.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Seiten: {asset.pageLinks.map((link) => link.page.title).join(", ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    {isPreviewable(asset.mimeType) ? (
                      <a
                        className={buttonVariants({ variant: "link", size: "sm" })}
                        href={`/api/assets/${asset.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Öffnen
                      </a>
                    ) : (
                      <a
                        className={buttonVariants({ variant: "link", size: "sm" })}
                        href={`/api/assets/${asset.id}/file`}
                        download
                      >
                        Download
                      </a>
                    )}
                    {asset.mimeType?.startsWith("image/") && (
                      <>
                        <a
                          className={buttonVariants({ variant: "link", size: "sm" })}
                          href={`/worlds/${worldSlug}/labels/new?sourceRef=asset:${asset.id}`}
                        >
                          Als Label
                        </a>
                        <form action={openAssetInImageStudioAction} className="inline-flex">
                          <input type="hidden" name="worldSlug" value={worldSlug} />
                          <input type="hidden" name="assetId" value={asset.id} />
                          <Button type="submit" variant="link" size="sm">
                            Image Studio
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">Bearbeiten &amp; Freigabe</summary>
                    <form action={updateAssetAction} className="mt-3 flex flex-col gap-4">
                      <input type="hidden" name="worldSlug" value={worldSlug} />
                      <input type="hidden" name="assetId" value={asset.id} />
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`asset-${asset.id}-title`}>Titel</Label>
                        <Input id={`asset-${asset.id}-title`} name="title" defaultValue={asset.title} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`asset-${asset.id}-description`}>Beschreibung</Label>
                        <Textarea
                          id={`asset-${asset.id}-description`}
                          name="description"
                          rows={2}
                          defaultValue={asset.description ?? ""}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`asset-${asset.id}-type`}>Typ</Label>
                        <Select name="type" defaultValue={asset.type}>
                          <SelectTrigger id={`asset-${asset.id}-type`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {ASSET_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`asset-${asset.id}-tags`}>Tags (kommagetrennt)</Label>
                        <Input
                          id={`asset-${asset.id}-tags`}
                          name="tags"
                          defaultValue={parseStringArray(asset.tags).join(", ")}
                          placeholder="karte, handout"
                        />
                      </div>
                      <div>
                        <Button type="submit">Speichern</Button>
                      </div>
                    </form>
                    <AssetTagProposalPanel
                      worldSlug={worldSlug}
                      assetId={asset.id}
                      proposedTags={proposedTags}
                    />
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Noch keine Assets für diesen Filter." />
        )}

        <details className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
          <summary className="cursor-pointer font-medium">Asset hochladen</summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            action={`/api/worlds/${worldSlug}/assets/upload`}
            method="post"
            encType="multipart/form-data"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-file">Datei</Label>
              <Input id="upload-file" type="file" name="file" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-title">Titel</Label>
              <Input id="upload-title" type="text" name="title" placeholder="Anzeigename" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="upload-description">Beschreibung</Label>
              <Textarea id="upload-description" name="description" rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                  "automatisch erkennen" — natives Select beibehalten. */}
              <Label htmlFor="upload-type">Typ</Label>
              <select id="upload-type" name="type" defaultValue="" className={NATIVE_SELECT_CLASS}>
                <option value="">Automatisch erkennen</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              {/* TODO(design-kit): Kit-Select (Radix) erlaubt keinen leeren value="" für
                  "keine Seite" — natives Select beibehalten. */}
              <Label htmlFor="upload-page">Seite zuordnen (optional)</Label>
              <select id="upload-page" name="pageId" defaultValue="" className={NATIVE_SELECT_CLASS}>
                <option value="">— Keine —</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button type="submit">Hochladen</Button>
            </div>
          </form>
        </details>

        <AssetBatchToolbar
          worldSlug={worldSlug}
          albums={albums.map((album) => ({
            id: album.id,
            title: album.title,
            count: album._count.items,
          }))}
          assets={assets.map((asset) => ({ id: asset.id, title: asset.title }))}
        />

        <details className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
          <summary className="cursor-pointer font-medium">Album anlegen</summary>
          <form action={createAssetAlbumAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="album-title">Neues Album</Label>
              <Input id="album-title" type="text" name="title" placeholder="Session 12 — Karten" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="album-description">Beschreibung</Label>
              <Input id="album-description" type="text" name="description" placeholder="Optional" />
            </div>
            <div>
              <Button type="submit" variant="secondary">
                Album anlegen
              </Button>
            </div>
          </form>
        </details>

        {assets.length > 0 && pages.length > 0 && (
          <details className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
            <summary className="cursor-pointer font-medium">Asset einer Seite zuordnen</summary>
            <form action={linkAssetToPageAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="link-asset">Asset</Label>
                <Select name="assetId" defaultValue={assets[0]?.id} required>
                  <SelectTrigger id="link-asset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="link-page">Seite</Label>
                <Select name="pageId" defaultValue={pages[0]?.id} required>
                  <SelectTrigger id="link-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button type="submit" variant="outline">
                  Verknüpfen
                </Button>
              </div>
            </form>
          </details>
        )}
      </div>
    </WorldShell>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
