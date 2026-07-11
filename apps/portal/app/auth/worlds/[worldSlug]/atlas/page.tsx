import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, Map as MapIcon, Mountain } from "lucide-react";
import {
  createAtlasService,
  createPrismaClient,
} from "@uwe/database/server";
import type { DbAtlasNode } from "@uwe/database/server";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { Badge } from "@/src/components/ui/badge";
import { PageHeader } from "@/src/components/shell";

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

const LEVEL_ICONS: Record<string, typeof Globe> = {
  globe: Globe,
  continent: MapIcon,
  landscape: Mountain,
  city: Building2,
};

const LEVEL_ORDER = ["globe", "continent", "landscape", "city"];

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
  const Icon = LEVEL_ICONS[node.level] ?? MapIcon;
  const levelLabel = LEVEL_LABELS[node.level] ?? node.level;

  return (
    <>
      <li style={{ paddingLeft: depth * 20 }}>
        <Link
          href={`/auth/worlds/${worldSlug}/atlas/${node.id}`}
          className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 font-medium">{node.title}</span>
          <span className="text-xs text-muted-foreground">{levelLabel}</span>
        </Link>
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

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalAtlasIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let worldName = worldSlug;
  let nodes: DbAtlasNode[] = [];

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) notFound();
    worldName = world.name;

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }

    const result = await atlas.getAtlasForContext(worldSlug, "portal");
    if (result) {
      nodes = result.nodes;
    }
  } finally {
    await db.$disconnect();
  }

  const tree = buildTree(nodes);

  const countByLevel: Record<string, number> = {};
  for (const node of nodes) {
    countByLevel[node.level] = (countByLevel[node.level] ?? 0) + 1;
  }

  return (
    <>
      <Link
        href={`/auth/worlds/${worldSlug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>

      <PageHeader title={`Atlas — ${worldName}`} />

      {nodes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Für diese Welt ist derzeit kein Atlas für Spieler sichtbar.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {LEVEL_ORDER.filter((lvl) => countByLevel[lvl]).map((lvl) => {
              const Icon = LEVEL_ICONS[lvl] ?? MapIcon;
              return (
                <Badge key={lvl} variant="secondary" className="gap-1.5 px-2.5 py-1">
                  <Icon className="size-3.5" aria-hidden />
                  {LEVEL_LABELS[lvl]}
                  <strong>{countByLevel[lvl]}</strong>
                </Badge>
              );
            })}
          </div>

          <ul className="mb-6 flex list-none flex-col gap-1 p-0">
            {tree.map((item) => (
              <NodeTreeRow key={item.node.id} item={item} worldSlug={worldSlug} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
