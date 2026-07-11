import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import type { DbAtlasNode } from "@uwe/database/server";
import { validateRtxAtlasAssetProposal } from "@uwe/atlas/rtx-asset-proposal";
import { GOUACHE_CATEGORY_LABELS } from "@uwe/atlas/assets";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DeleteAtlasNodeButton } from "@/src/components/atlas/DeleteAtlasNodeButton";
import {
  RtxAssetReviewList,
  type RtxAssetReviewItemView,
} from "@/src/components/atlas/RtxAssetReviewList";
import {
  ensureAtlasAction,
  createAtlasNodeAction,
} from "../../../atlas-actions";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  NavIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui";

// ---------------------------------------------------------------------------
// Level display helpers
// ---------------------------------------------------------------------------

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

/** Lucide icon names (kebab-case, resolved via NavIcon) for each atlas level. */
const LEVEL_ICON_NAMES: Record<string, string> = {
  globe: "globe",
  continent: "map",
  landscape: "mountain",
  city: "building-2",
};

const LEVEL_ORDER = ["globe", "continent", "landscape", "city"];

interface Props {
  params: Promise<{ worldSlug: string }>;
}

// ---------------------------------------------------------------------------
// Tree rendering helpers
// ---------------------------------------------------------------------------

interface NodeTreeItem {
  node: DbAtlasNode;
  children: NodeTreeItem[];
}

function buildTree(nodes: DbAtlasNode[]): NodeTreeItem[] {
  const map = new Map<string, NodeTreeItem>();
  for (const node of nodes) {
    map.set(node.id, { node, children: [] });
  }
  const roots: NodeTreeItem[] = [];
  for (const item of map.values()) {
    if (item.node.parentId && map.has(item.node.parentId)) {
      map.get(item.node.parentId)!.children.push(item);
    } else {
      roots.push(item);
    }
  }
  // Sort by level order then sortOrder
  function sortItems(items: NodeTreeItem[]) {
    items.sort((a, b) => {
      const la = LEVEL_ORDER.indexOf(a.node.level);
      const lb = LEVEL_ORDER.indexOf(b.node.level);
      if (la !== lb) return la - lb;
      return a.node.sortOrder - b.node.sortOrder;
    });
    for (const item of items) sortItems(item.children);
  }
  sortItems(roots);
  return roots;
}

/** Count all nested nodes below an item (excluding the item itself). */
function countDescendants(item: NodeTreeItem): number {
  let total = item.children.length;
  for (const child of item.children) {
    total += countDescendants(child);
  }
  return total;
}

function NodeTreeRow({
  item,
  worldSlug,
  depth = 0,
}: {
  item: NodeTreeItem;
  worldSlug: string;
  depth?: number;
}) {
  const { node, children } = item;
  const iconName = LEVEL_ICON_NAMES[node.level] ?? "map-pin";
  const levelLabel = LEVEL_LABELS[node.level] ?? node.level;
  const isPlayerVisible = node.visibility === "player_visible" || node.visibility === "public";

  return (
    <>
      {/* Indentation is the only genuinely dynamic style left (per tree depth). */}
      <li className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
        <a
          href={`/worlds/${worldSlug}/atlas/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          <NavIcon name={iconName} width={16} height={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate">{node.title}</span>
          <span className="text-xs text-muted-foreground">{levelLabel}</span>
          {isPlayerVisible ? (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <NavIcon name="check" width={12} height={12} /> Spieler
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <NavIcon name="lock" width={12} height={12} /> DM
            </span>
          )}
        </a>
        <DeleteAtlasNodeButton
          worldSlug={worldSlug}
          nodeId={node.id}
          title={node.title}
          descendantCount={countDescendants(item)}
        />
      </li>
      {children.map((child) => (
        <NodeTreeRow
          key={child.node.id}
          item={child}
          worldSlug={worldSlug}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pending RTX asset review helpers
// ---------------------------------------------------------------------------

/**
 * Re-validate a pending `rtx_asset` palette item's stored proposal.
 * `styleTags` content is never rendered without going through
 * `validateRtxAtlasAssetProposal` again — items whose stored JSON fails the
 * validator are marked invalid and only offer deletion.
 */
function toRtxAssetReviewItemView(item: {
  id: string;
  name: string;
  styleTags: unknown;
}): RtxAssetReviewItemView {
  const styleTags = item.styleTags;
  const raw =
    styleTags && typeof styleTags === "object" && !Array.isArray(styleTags)
      ? (styleTags as Record<string, unknown>).rtxAssetProposal
      : undefined;
  const validation = validateRtxAtlasAssetProposal(raw);
  if (!validation.ok) {
    return { id: item.id, name: item.name, valid: false };
  }
  const proposal = validation.proposal;
  const base = {
    id: item.id,
    name: proposal.name,
    valid: true as const,
    categoryLabel: GOUACHE_CATEGORY_LABELS[proposal.category] ?? proposal.category,
    tags: proposal.tags,
    engineTags: proposal.engineTags,
    outputType: proposal.outputType,
  };
  if (proposal.outputType === "json-recipe") {
    return { ...base, recipe: proposal.recipe };
  }
  const png = proposal.pngFallback;
  return {
    ...base,
    pngLabel: `PNG ${png.width}×${png.height}${png.transparentBackground ? " · transparent" : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AtlasIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let nodes: DbAtlasNode[] = [];
  let mapId: string | null = null;
  let pendingRtxAssets: Array<{ id: string; name: string; styleTags: unknown }> = [];

  try {
    const map = await db.atlasMap.findUnique({ where: { worldId: world.id } });
    if (map) {
      mapId = map.id;
      nodes = await atlas.listNodesForMap(map.id);
    }
    pendingRtxAssets = await db.atlasPaletteItem.findMany({
      where: { worldId: world.id, kind: "rtx_asset", reviewStatus: "pending" },
      orderBy: { createdAt: "asc" },
    });
  } finally {
    await db.$disconnect();
  }

  const rtxReviewItems = pendingRtxAssets.map(toRtxAssetReviewItemView);

  const tree = buildTree(nodes);

  // Group top-level nodes by level for the summary header.
  const countByLevel: Record<string, number> = {};
  for (const node of nodes) {
    countByLevel[node.level] = (countByLevel[node.level] ?? 0) + 1;
  }

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Atlas", `/worlds/${worldSlug}/atlas`)}
        />
      }
    >
      <PageHeader
        title="Atlas / Weltkarte"
        summary="Zeichne Kontinente, Regionen, Flüsse und Ortschaften im Tolkien-Ink-Stil."
      />

      <div className="flex flex-col gap-6">
        {nodes.length === 0 ? (
          <EmptyState
            title="Noch kein Atlas für diese Welt"
            description="Erstelle jetzt den ersten Kontinent-Knoten."
            action={
              <form action={ensureAtlasAction}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <Button type="submit">Atlas erstellen &amp; Editor öffnen</Button>
              </form>
            }
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {/* Level summary */}
              <div className="flex flex-wrap gap-2">
                {LEVEL_ORDER.filter((lvl) => countByLevel[lvl]).map((lvl) => (
                  <Badge key={lvl} variant="secondary" className="gap-1.5">
                    <NavIcon name={LEVEL_ICON_NAMES[lvl] ?? "map-pin"} width={14} height={14} />
                    {LEVEL_LABELS[lvl]}
                    <strong>{countByLevel[lvl]}</strong>
                  </Badge>
                ))}
              </div>

              {/* Node tree */}
              <ul className="flex flex-col gap-1">
                {tree.map((item) => (
                  <NodeTreeRow key={item.node.id} item={item} worldSlug={worldSlug} />
                ))}
              </ul>

              {/* Create new top-level node form */}
              {mapId && (
                <details>
                  <summary className="cursor-pointer text-sm text-primary">
                    + Neuen Knoten anlegen
                  </summary>
                  <form action={createAtlasNodeAction} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <div className="flex min-w-[180px] flex-col gap-1.5">
                      <Label htmlFor="atlas-new-node-title">Name</Label>
                      <Input id="atlas-new-node-title" name="title" placeholder="Knotenname" required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="atlas-new-node-level">Ebene</Label>
                      <Select name="level" defaultValue={LEVEL_ORDER[0]}>
                        <SelectTrigger id="atlas-new-node-level" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVEL_ORDER.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>
                              {LEVEL_LABELS[lvl]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" variant="secondary">
                      Knoten anlegen
                    </Button>
                  </form>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending RTX asset review — approve/delete via existing actions */}
        {rtxReviewItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ausstehende RTX-Assets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                KI-generierte Gouache-Asset-Proposals warten auf Genehmigung. Genehmigen
                schaltet nur das Palette-Item frei — es entstehen keine Kartenobjekte.
              </p>
              <RtxAssetReviewList worldSlug={worldSlug} items={rtxReviewItems} />
            </CardContent>
          </Card>
        )}
      </div>
    </WorldShell>
  );
}
