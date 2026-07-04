import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import type { DbAtlasNode } from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { DeleteAtlasNodeButton } from "@/src/components/atlas/DeleteAtlasNodeButton";
import {
  ensureAtlasAction,
  createAtlasNodeAction,
} from "../../../atlas-actions";

// ---------------------------------------------------------------------------
// Level display helpers
// ---------------------------------------------------------------------------

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

const LEVEL_ICONS: Record<string, string> = {
  globe: "🌍",
  continent: "🗺️",
  landscape: "🏔️",
  city: "🏙️",
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
  const icon = LEVEL_ICONS[node.level] ?? "📍";
  const levelLabel = LEVEL_LABELS[node.level] ?? node.level;

  return (
    <>
      <li
        className="uwe-atlas-node-item"
        style={{ paddingLeft: depth * 20, display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <a
          href={`/worlds/${worldSlug}/atlas/${node.id}`}
          className="uwe-atlas-node-link"
          style={{ flex: 1, minWidth: 0 }}
        >
          <span className="uwe-atlas-node-icon">{icon}</span>
          <span className="uwe-atlas-node-title">{node.title}</span>
          <span className="uwe-atlas-node-level" style={{ opacity: 0.6, fontSize: "0.8em" }}>
            {levelLabel}
          </span>
          {node.visibility === "player_visible" || node.visibility === "public" ? (
            <span style={{ fontSize: "0.7em", color: "var(--uwe-success, #16a34a)", marginLeft: 4 }}>
              ✓ Spieler
            </span>
          ) : (
            <span style={{ fontSize: "0.7em", color: "var(--uwe-muted)", marginLeft: 4 }}>
              🔒 DM
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

  try {
    const map = await db.atlasMap.findUnique({ where: { worldId: world.id } });
    if (map) {
      mapId = map.id;
      nodes = await atlas.listNodesForMap(map.id);
    }
  } finally {
    await db.$disconnect();
  }

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

      {nodes.length === 0 ? (
        <section className="uwe-atlas-empty">
          <p className="uwe-hint">
            Noch kein Atlas für diese Welt. Erstelle jetzt den ersten Kontinent-Knoten.
          </p>
          <form action={ensureAtlasAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Atlas erstellen &amp; Editor öffnen
            </button>
          </form>
        </section>
      ) : (
        <section className="uwe-atlas-nodes">
          {/* Level summary */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}>
            {LEVEL_ORDER.filter((lvl) => countByLevel[lvl]).map((lvl) => (
              <span
                key={lvl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.2rem 0.6rem",
                  background: "var(--uwe-surface)",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: "var(--uwe-radius)",
                  fontSize: 13,
                }}
              >
                {LEVEL_ICONS[lvl]} {LEVEL_LABELS[lvl]}
                <strong>{countByLevel[lvl]}</strong>
              </span>
            ))}
          </div>

          {/* Node tree */}
          <ul
            className="uwe-atlas-node-list"
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {tree.map((item) => (
              <NodeTreeRow key={item.node.id} item={item} worldSlug={worldSlug} />
            ))}
          </ul>

          {/* Create new top-level node form */}
          {mapId && (
            <details className="uwe-atlas-create-details" style={{ marginTop: "0.5rem" }}>
              <summary
                style={{ cursor: "pointer", fontSize: 14, color: "var(--uwe-accent)" }}
              >
                + Neuen Knoten anlegen
              </summary>
              <form action={createAtlasNodeAction} className="uwe-atlas-create-form" style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.75rem",
                alignItems: "flex-end",
              }}>
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: 13 }}>
                  Name
                  <input
                    name="title"
                    className="uwe-input"
                    placeholder="Knotenname"
                    required
                    style={{ minWidth: 180 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: 13 }}>
                  Ebene
                  <select name="level" className="uwe-input">
                    {LEVEL_ORDER.map((lvl) => (
                      <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl]}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                  Knoten anlegen
                </button>
              </form>
            </details>
          )}
        </section>
      )}
    </WorldShell>
  );
}
