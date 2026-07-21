/**
 * One-off dev seed: showcase Atlas 3D world for manual GUI testing — split
 * globe held together by world-roots, a bitten sector, placed ink assets,
 * an orbiting asteroid and a drilled-down continent with a river.
 * Idempotent: skips when the demo continent already exists.
 *
 *   pnpm --filter @uwe/database exec tsx ../../scripts/atlas3d-demo-seed.ts
 */
import { createPrismaClient } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";

async function main() {
  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  try {
    const { atlasWorld, rootNode } = await atlas3d.getOrCreateForWorld("terra");
    const existing = await db.atlas3DNode.findFirst({
      where: { atlasWorldId: atlasWorld.id, title: "Velthara (Demo)" },
    });
    if (existing) {
      console.log("Atlas3D demo already seeded — skipped.");
      return;
    }

    await atlas3d.saveTerrain(rootNode.id, {
      carveOps: [
        { id: "welt-spalt", kind: "split", normal: [1, 0, 0], gap: 0.3, cutMaterial: "glut" },
        { id: "demo-biss", kind: "bite", center: [0.62, 0.55, 0.62], radius: 0.5, cutMaterial: "fels" },
      ],
      meta: { splitGap: 0.3, heightmap: null, splat: null },
    });

    await atlas3d.saveObjects(rootNode.id, [
      { assetKind: "worldroot", position: { dir: [0, 0.35, 0.94] }, tint: "paper", scale: 1.4 },
      { assetKind: "tree", position: { dir: [-0.5, 0.2, 0.84] }, tint: "teal" },
      { assetKind: "tower", position: { dir: [0.3, -0.4, 0.87] }, tint: "paper" },
      {
        assetKind: "asteroid",
        position: { orbit: { radius: 1.9, inclination: 0.35, phase: 0.8, speed: 0.12 } },
        tint: "sepia",
      },
    ]);

    const regionDirs = [
      [-0.25, 0.42, 0.87],
      [0.05, 0.55, 0.83],
      [0.2, 0.3, 0.93],
      [-0.1, 0.18, 0.98],
    ];
    const feature = await db.atlas3DFeature.create({
      data: { nodeId: rootNode.id, kind: "region", geometry: { points: regionDirs }, labelText: "Velthara (Demo)" },
    });
    const continent = await atlas3d.createChildNode({
      parentId: rootNode.id,
      title: "Velthara (Demo)",
      sourceFeatureId: feature.id,
      seed: 8231,
      silhouette: {
        points: [
          [-1.5, -1.1],
          [1.4, -1.3],
          [1.6, 1.0],
          [-0.2, 1.6],
          [-1.7, 0.6],
        ],
      },
    });
    await atlas3d.saveFeatures(
      continent.id,
      [
        {
          kind: "river",
          geometry: { points: [{ x: -1.2, z: -0.6 }, { x: -0.4, z: -0.1 }, { x: 0.4, z: 0.3 }, { x: 1.2, z: 0.7 }] },
        },
        { kind: "label", geometry: { points: [{ x: 0, z: -0.4 }] }, labelText: "Velthara" },
      ],
      { kinds: ["river", "road", "label"] },
    );
    await atlas3d.saveObjects(continent.id, [
      { assetKind: "worldroot", position: { x: 0.9, z: -1.0 }, tint: "paper", scale: 1.3 },
      { assetKind: "tree", position: { x: 0.3, z: -0.7 }, tint: "teal" },
      { assetKind: "tree", position: { x: 0.55, z: -0.5 }, tint: "teal", rotation: 1.2 },
      { assetKind: "house", position: { x: 1.1, z: 0.5 }, tint: "terra" },
      { assetKind: "tower", position: { x: -1.1, z: -0.6 }, tint: "paper" },
    ]);
    await atlas3d.saveBookmarks(rootNode.id, [
      { name: "Spalt-Blick", pose: { position: [0, 0.6, 3.2], target: [0, 0, 0], fov: 50 } },
    ]);

    console.log(`Atlas3D demo seeded: globe ${rootNode.id}, continent ${continent.id}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
