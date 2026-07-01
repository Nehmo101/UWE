import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
} from "@uwe/database/server";
import type { DbAtlasNode } from "@uwe/database/server";

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

// ---------------------------------------------------------------------------
// Tree helpers
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
  const icon = LEVEL_ICONS[node.level] ?? "📍";
  const levelLabel = LEVEL_LABELS[node.level] ?? node.level;

  return (
    <>
      <li
        className="uwe-atlas-node-item"
        style={{ paddingLeft: depth * 20 }}
      >
        <a
          href={`/auth/worlds/${worldSlug}/atlas/${node.id}`}
          className="uwe-atlas-node-link"
        >
          <span className="uwe-atlas-node-icon">{icon}</span>
          <span className="uwe-atlas-node-title">{node.title}</span>
          <span className="uwe-atlas-node-level" style={{ opacity: 0.6, fontSize: "0.8em" }}>
            {levelLabel}
          </span>
        </a>
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

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalAtlasIndexPage({ params }: Props) {
  const { worldSlug } = await params;

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let worldName = worldSlug;
  let nodes: DbAtlasNode[] = [];

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });
    if (!world) notFound();
    worldName = world.name;

    const result = await atlas.getAtlasForContext(worldSlug, "portal");
    if (!result) {
      // Atlas doesn't exist or is not visible to players — show empty state
    } else {
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

  // Shell (sidebar, top bar, mobile bottom nav) comes from the world layout —
  // no nested PortalShell here.
  return (
    <section className="portal-content-card">
      <a href={`/auth/worlds/${worldSlug}`} className="uwe-back-link">
        ← Zurück zur Übersicht
      </a>

      <h1>Atlas — {worldName}</h1>

      {nodes.length === 0 ? (
        <p className="uwe-hint" style={{ color: "var(--uwe-muted)", marginTop: "1rem" }}>
          Für diese Welt ist derzeit kein Atlas für Spieler sichtbar.
        </p>
      ) : (
        <>
          {/* Level summary chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
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
        </>
      )}
    </section>
  );
}
