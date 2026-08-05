import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DUNGEON_PREP_STATUS_LABELS,
  DungeonPrepStatusBadge,
  ResponsiveTable,
  WikiContent,
} from "@uwe/shared-ui";
import {
  buildWorldWikiIndex,
  createDungeonCockpitService,
  DungeonPrepStatusEnum,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import {
  createDungeonLevelAction,
  linkAssetToDungeonPageAction,
  updateDungeonEntityAction,
} from "../../../../dungeon-actions";
import { DungeonLevelLayout } from "@/components/worlds/DungeonLevelLayout";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { DungeonSidePages } from "@/src/components/dungeon/DungeonSidePages";
import { CampaignSidebar } from "@/src/components/wiki";
import { dungeonBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; dungeonSlug: string }>;
  searchParams: Promise<{ saved?: string; assetLinked?: string }>;
}

const SECTION_CLASS = "mb-8 flex flex-col gap-3";
const FIELD_CLASS = "flex flex-col gap-1.5";
const HEADING_CLASS = "m-0 text-lg font-semibold tracking-tight";

export default async function StudioDungeonDetailPage({ params, searchParams }: Props) {
  const { worldSlug, dungeonSlug } = await params;
  const { saved, assetLinked } = await searchParams;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const wikiIndex = await buildWorldWikiIndex(repo, worldSlug);
  const dungeons = createDungeonCockpitService();
  const overview = await dungeons.getDungeonOverview(worldSlug, dungeonSlug, wikiIndex);
  if (!overview) notFound();

  const assets = await repo.listAssetsByWorld(worldSlug);
  const linkedAssetIds = new Set(overview.assets.map((a) => a.id));
  const linkableAssets = assets.filter((a) => !linkedAssetIds.has(a.id));
  const redirectTo = `/worlds/${worldSlug}/dungeons/${dungeonSlug}`;

  // Rückweg ins Kampagnen-Modul: hängt der Dungeon an einem Kapitel
  // (parentPageId auf eine story_arc-Seite), führt ein Link dorthin zurück.
  const chapterParent = await prisma.page.findFirst({
    where: {
      worldId: world.id,
      slug: dungeonSlug,
      type: "dungeon",
      parentPage: { type: "story_arc" },
    },
    select: {
      parentPage: {
        select: { title: true, slug: true, campaign: { select: { slug: true } } },
      },
    },
  });
  const chapterLink =
    chapterParent?.parentPage && chapterParent.parentPage.campaign
      ? {
          title: chapterParent.parentPage.title,
          href: `/worlds/${worldSlug}/kampagnen/${chapterParent.parentPage.campaign.slug}/kapitel/${chapterParent.parentPage.slug}`,
        }
      : null;

  return (
    <>
      <ShellBreadcrumb
        items={dungeonBreadcrumb(world.name, worldSlug, [
          { label: overview.dungeon.title },
        ])}
      />
      <ShellContextPanel>
        <CampaignSidebar
          title="Ebenen"
          items={overview.levels.map((level) => ({
            label: level.title,
            href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`,
          }))}
        />
      </ShellContextPanel>
      <PageHeader
        title={overview.dungeon.title}
        summary={overview.dungeon.summary ?? undefined}
        meta={
          <>
            <DungeonPrepStatusBadge status={overview.dungeon.prepStatus} />
            {chapterLink ? (
              <span className="text-sm text-muted-foreground">
                Teil von Kapitel <Link href={chapterLink.href}>{chapterLink.title}</Link>
              </span>
            ) : null}
          </>
        }
      />
      {saved && <Alert tone="success" className="mb-4">Dungeon gespeichert.</Alert>}
      {assetLinked && <Alert tone="success" className="mb-4">Asset verknüpft.</Alert>}

      <DungeonLevelLayout
        worldSlug={worldSlug}
        dungeonSlug={dungeonSlug}
        levels={overview.levels.map((level) => ({
          id: level.id,
          title: level.title,
          slug: level.slug,
          prepStatus: level.prepStatus,
        }))}
      />

      <DungeonSidePages
        worldSlug={worldSlug}
        pages={overview.appendix}
        title="Weitere Seiten"
        emptyHint="Keine weiteren Seiten an diesem Dungeon"
      />

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Ebenen</h2>
        {overview.levels.length === 0 ? (
          <EmptyState title="Noch keine Ebenen" />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ResponsiveTable
                caption="Ebenen"
                rowKey={(level) => level.id}
                rows={overview.levels}
                columns={[
                  {
                    key: "level",
                    label: "Ebene",
                    primary: true,
                    render: (level) => (
                      <Link
                        href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`}
                      >
                        {level.title}
                      </Link>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (level) => <DungeonPrepStatusBadge status={level.prepStatus} />,
                  },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Neue Ebene</h2>
        <form action={createDungeonLevelAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="dungeonSlug" value={dungeonSlug} />
          <div className={FIELD_CLASS}>
            <Label htmlFor="new-level-title">Titel</Label>
            <Input id="new-level-title" name="title" required placeholder="Ebene 1 — Eingangshalle" />
          </div>
          <div className={FIELD_CLASS}>
            <Label htmlFor="new-level-status">Status</Label>
            <Select name="prepStatus" defaultValue="unprepared">
              <SelectTrigger id="new-level-status" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DungeonPrepStatusEnum).map((status) => (
                  <SelectItem key={status} value={status}>
                    {DUNGEON_PREP_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Ebene anlegen</Button>
        </form>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Beschreibung</h2>
        <WikiContent html={overview.html} />
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Assets &amp; Karten</h2>
        {overview.assets.length > 0 && (
          <ul className="flex flex-col gap-2">
            {overview.assets.map((asset) => (
              <li key={asset.id} className="text-sm">
                {asset.title} ({asset.type})
              </li>
            ))}
          </ul>
        )}
        {linkableAssets.length > 0 && (
          <form action={linkAssetToDungeonPageAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="pageId" value={overview.dungeon.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className={FIELD_CLASS}>
              <Label htmlFor="dungeon-link-asset">Asset verknüpfen</Label>
              {/* TODO(design-kit): natives select statt Kit-Select — Radix Select erlaubt
                  keinen leeren value="" für den Platzhalter "— wählen —". */}
              <select
                id="dungeon-link-asset"
                name="assetId"
                required
                className="h-9 w-56 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— wählen —</option>
                {linkableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.title}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">Verknüpfen</Button>
          </form>
        )}
      </section>

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Metadaten</h2>
        <Card>
          <CardHeader>
            <CardTitle>Dungeon-Metadaten bearbeiten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateDungeonEntityAction} className="flex flex-col gap-4">
              <input type="hidden" name="pageId" value={overview.dungeon.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <div className={FIELD_CLASS}>
                <Label htmlFor="dungeon-meta-title">Titel</Label>
                <Input id="dungeon-meta-title" name="title" defaultValue={overview.dungeon.title} required />
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor="dungeon-meta-summary">Zusammenfassung</Label>
                <Textarea
                  id="dungeon-meta-summary"
                  name="summary"
                  rows={2}
                  defaultValue={overview.dungeon.summary ?? ""}
                />
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor="dungeon-meta-status">Status</Label>
                <Select name="prepStatus" defaultValue={overview.dungeon.prepStatus ?? "unprepared"}>
                  <SelectTrigger id="dungeon-meta-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DungeonPrepStatusEnum).map((status) => (
                      <SelectItem key={status} value={status}>
                        {DUNGEON_PREP_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
