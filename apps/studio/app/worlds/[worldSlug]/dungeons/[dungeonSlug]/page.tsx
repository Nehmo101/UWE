import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DungeonPrepStatusBadge,
  DUNGEON_PREP_STATUS_LABELS,
  PUBLISH_LABELS,
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
import { DungeonLevelLayout } from "@/components/worlds/DungeonLevelLayout";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
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
const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2";

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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={dungeonBreadcrumb(world.name, worldSlug, [
            { label: overview.dungeon.title },
          ])}
        />
      }
      contextPanel={
        <CampaignSidebar
          title="Ebenen"
          items={overview.levels.map((level) => ({
            label: level.title,
            href: `/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`,
          }))}
        />
      }
    >
      <PageHeader
        title={overview.dungeon.title}
        summary={overview.dungeon.summary ?? undefined}
        meta={<DungeonPrepStatusBadge status={overview.dungeon.prepStatus} />}
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

      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Ebenen</h2>
        {overview.levels.length === 0 ? (
          <EmptyState title="Noch keine Ebenen" />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={TH_CLASS}>Ebene</th>
                      <th className={TH_CLASS}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.levels.map((level) => (
                      <tr key={level.id}>
                        <td className={TD_CLASS}>
                          <Link href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`}>
                            {level.title}
                          </Link>
                        </td>
                        <td className={TD_CLASS}>
                          <DungeonPrepStatusBadge status={level.prepStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <div className={FIELD_CLASS}>
                <Label htmlFor="dungeon-meta-visibility">Sichtbarkeit</Label>
                <Select name="visibility" defaultValue={overview.dungeon.visibility}>
                  <SelectTrigger id="dungeon-meta-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(VisibilityEnum).map((v) => (
                      <SelectItem key={v} value={v}>{VISIBILITY_LABELS[v]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={FIELD_CLASS}>
                <Label htmlFor="dungeon-meta-publish">Publish</Label>
                <Select name="publishStatus" defaultValue={overview.dungeon.publishStatus}>
                  <SelectTrigger id="dungeon-meta-publish">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PublishStatusEnum).map((s) => (
                      <SelectItem key={s} value={s}>{PUBLISH_LABELS[s]}</SelectItem>
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
    </WorldShell>
  );
}
