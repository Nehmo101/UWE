/**
 * One-off dev seed: create a demo Atlas node with a biome polygon + region for
 * manual GUI testing of the CoK-style tools. Idempotent by node title.
 *
 *   pnpm --filter @uwe/database exec tsx ../../scripts/atlas-cok-demo-seed.ts
 */
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";

async function main() {
  const db = createPrismaClient();
  const atlas = createAtlasService(db);
  const repo = getAppRepository();
  try {
    const world = await repo.getWorldBySlug("terra");
    if (!world) throw new Error("world terra not found");

    const map = await atlas.getOrCreateAtlasForWorld(world.id);
    await atlas.ensureBuiltinPaletteItems();

    const nodes = await atlas.listNodesForMap(map.id);
    const TITLE = "CoK Demo";
    let node = nodes.find((n) => n.title === TITLE);
    if (!node) {
      node = await atlas.createNode({
        mapId: map.id,
        level: "continent",
        title: TITLE,
        visibility: "dm_only",
        sortOrder: 0,
      });
      await atlas.createFeature({
        nodeId: node.id,
        kind: "biome",
        geometry: {
          type: "Polygon",
          rings: [[
            [0.18, 0.22],
            [0.55, 0.18],
            [0.62, 0.55],
            [0.24, 0.62],
            [0.18, 0.22],
          ]],
        },
        style: { biomeKind: "forest", density: 1.6 },
        layer: 10,
        sortOrder: 0,
        visibility: "dm_only",
      });
      await atlas.createFeature({
        nodeId: node.id,
        kind: "region",
        geometry: {
          type: "Polygon",
          rings: [[
            [0.66, 0.3],
            [0.9, 0.34],
            [0.86, 0.7],
            [0.64, 0.66],
            [0.66, 0.3],
          ]],
        },
        labelColor: "black",
        layer: 10,
        sortOrder: 1,
        visibility: "dm_only",
      });
    }

    // Ensure a river + road path exist (idempotent) for Phase 2 testing.
    const feats = await atlas.listFeaturesForNode(node.id);
    if (!feats.some((f) => f.kind === "road")) {
      await atlas.createFeature({
        nodeId: node.id,
        kind: "road",
        geometry: {
          type: "Path",
          coordinates: [
            [0.2, 0.8],
            [0.4, 0.74],
            [0.55, 0.82],
            [0.72, 0.76],
            [0.88, 0.84],
          ],
        },
        layer: 40,
        sortOrder: 2,
        visibility: "dm_only",
      });
    }
    if (!feats.some((f) => f.kind === "river")) {
      await atlas.createFeature({
        nodeId: node.id,
        kind: "river",
        geometry: {
          type: "Path",
          coordinates: [
            [0.12, 0.1],
            [0.22, 0.32],
            [0.18, 0.5],
            [0.3, 0.68],
            [0.28, 0.9],
          ],
        },
        layer: 30,
        sortOrder: 3,
        visibility: "dm_only",
      });
    }

    console.log(`NODE_URL=/worlds/terra/atlas/${node.id}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
