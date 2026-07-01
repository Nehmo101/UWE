/**
 * Generate sample atlas/data.json for docs/design/claude-design-export/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  createAtlasService,
  createPrismaClient,
  createUweRepository,
} from "@uwe/database/server";
import { exportWorldStatic } from "../src/export-world";

const OUT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/design/claude-design-export/source/data.json",
);

async function main() {
  const databaseUrl = createTestDatabaseUrl();
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-claude-atlas-"));
  const worldSlug = "claude-design-export";

  const repo = createUweRepository(databaseUrl);
  const world = await repo.createWorld({
    name: "Claude Design Export",
    slug: worldSlug,
    description: "Sample world for Claude Design atlas bundle",
  });

  await repo.createPage({
    worldId: world.id,
    title: "Validori",
    slug: "validori",
    type: "location",
    summary: "Hafenstadt am Westmeer",
    visibility: "public",
    publishStatus: "published",
    contentBlocks: [
      {
        type: "rich_text",
        sortOrder: 0,
        visibility: "public",
        content: "Validori liegt an der Küste.",
      },
    ],
  });

  const db = createPrismaClient(databaseUrl);
  const atlas = createAtlasService(db);
  const map = await atlas.getOrCreateAtlasForWorld(world.id);
  await atlas.updateAtlasMap(map.id, { visibility: "player_visible" });
  const node = await atlas.createNode({
    mapId: map.id,
    level: "continent",
    title: "Westland",
    visibility: "player_visible",
  });

  await atlas.createFeature({
    nodeId: node.id,
    kind: "biome",
    geometry: {
      type: "Polygon",
      rings: [
        [
          [0.12, 0.18],
          [0.58, 0.14],
          [0.72, 0.52],
          [0.28, 0.68],
          [0.12, 0.18],
        ],
      ],
    },
    style: { biomeKind: "forest", density: 1.4 },
    layer: 10,
    sortOrder: 0,
    visibility: "player_visible",
  });

  await atlas.createFeature({
    nodeId: node.id,
    kind: "river",
    geometry: {
      type: "Path",
      coordinates: [
        [0.35, 0.2],
        [0.42, 0.38],
        [0.48, 0.55],
      ],
    },
    layer: 20,
    sortOrder: 1,
    visibility: "player_visible",
  });

  await atlas.createFeature({
    nodeId: node.id,
    kind: "road",
    geometry: {
      type: "Path",
      coordinates: [
        [0.22, 0.45],
        [0.55, 0.42],
        [0.68, 0.58],
      ],
    },
    layer: 25,
    sortOrder: 2,
    visibility: "player_visible",
  });

  await atlas.createFeature({
    nodeId: node.id,
    kind: "region",
    geometry: {
      type: "Polygon",
      rings: [
        [
          [0.55, 0.22],
          [0.88, 0.26],
          [0.84, 0.62],
          [0.52, 0.58],
          [0.55, 0.22],
        ],
      ],
    },
    labelText: "Ostmark",
    labelColor: "black",
    layer: 30,
    sortOrder: 3,
    visibility: "player_visible",
  });

  await atlas.ensureBuiltinPaletteItems();
  const palette = await atlas.listPaletteItems(world.id);
  const cityGlyph = palette.find((item) => item.builtinGlyphKey === "city");
  if (cityGlyph) {
    await atlas.createObject({
      nodeId: node.id,
      paletteItemId: cityGlyph.id,
      x: 0.38,
      y: 0.48,
      scale: 1,
      rotation: 0,
      layer: 40,
      sortOrder: 0,
      visibility: "player_visible",
    });
  }

  await atlas.createNode({
    mapId: map.id,
    level: "continent",
    title: "Geheimland",
    visibility: "dm_only",
  });

  await exportWorldStatic(repo, {
    worldSlug,
    outputDir,
    databaseUrl,
  });

  const dataJson = fs.readFileSync(path.join(outputDir, "atlas/data.json"), "utf8");
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, dataJson);

  await db.$disconnect();
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
