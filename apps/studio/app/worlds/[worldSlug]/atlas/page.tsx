import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { ensureAtlasAction, createAtlasNodeAction } from "../../../atlas-actions";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function AtlasIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let nodes: Awaited<ReturnType<typeof atlas.listNodesForMap>> = [];
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

  const continentNodes = nodes.filter((n) => n.level === "continent");

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

      {continentNodes.length === 0 ? (
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
          <h2>Kontinent-Knoten</h2>
          <ul className="uwe-atlas-node-list">
            {continentNodes.map((node) => (
              <li key={node.id} className="uwe-atlas-node-item">
                <a
                  href={`/worlds/${worldSlug}/atlas/${node.id}`}
                  className="uwe-atlas-node-link"
                >
                  <span className="uwe-atlas-node-icon">🗺️</span>
                  <span className="uwe-atlas-node-title">{node.title}</span>
                  <span className="uwe-atlas-node-level">{node.level}</span>
                </a>
              </li>
            ))}
          </ul>

          {mapId && (
            <form action={createAtlasNodeAction} className="uwe-atlas-create-form">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="level" value="continent" />
              <label>
                Neuer Kontinent
                <input
                  name="title"
                  className="uwe-input"
                  placeholder="Kontinent-Name"
                  required
                />
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                Kontinent anlegen
              </button>
            </form>
          )}
        </section>
      )}
    </WorldShell>
  );
}
