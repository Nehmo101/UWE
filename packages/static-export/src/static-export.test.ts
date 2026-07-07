import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createUweRepository, createAtlasService, createPrismaClient } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { exportWorldStatic } from "./export-world";
import { portalUrlToStaticHref, relativeHref } from "./paths";

const CUSTOM_STAMP_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const AI_STAMP_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lH9u7wAAAABJRU5ErkJggg==";
const PENDING_AI_STAMP_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Valid RTX gouache json recipe (validator shape, base-center-normalized). */
const RTX_RECIPE = {
  schemaVersion: 1,
  coordinateSystem: "base-center-normalized",
  layers: [
    { id: "shadow", role: "shadow", shape: "ellipse", fill: "#241a10", x: 0, y: 0.4, rx: 1.8, ry: 0.5 },
    { id: "base", role: "base", shape: "rect", fill: "#8a6d3b", stroke: "#241a10", x: 0, y: -1, width: 1.6, height: 2.8 },
    { id: "roof", role: "detail", shape: "polygon", fill: "#a03c28", points: [[-1, -2.4], [1, -2.4], [0, -3.4]] },
  ],
};

/** Full proposal incl. review-only metadata that must NEVER be exported. */
function rtxProposal(name: string) {
  return {
    name,
    category: "structure",
    tags: ["rtx-geheim-tag"],
    engineTags: ["Stamp"],
    palette: ["#8a6d3b"],
    prompt: "rtx-geheimer-prompt wachturm",
    rationale: "rtx-geheime-begruendung",
    styleguideNotes: "rtx-geheime-styleguide-notiz",
    outputType: "json-recipe",
    recipe: RTX_RECIPE,
  };
}

const RTX_PNG_FALLBACK_PROPOSAL = {
  name: "RTX PNG Fallback",
  category: "structure",
  tags: [],
  engineTags: [],
  palette: [],
  prompt: "rtx-geheimer-prompt png",
  outputType: "png-fallback",
  pngFallback: { mimeType: "image/png", width: 64, height: 64, transparentBackground: true },
};

describe("static export", () => {
  let databaseUrl: string;
  let outputDir: string;
  let worldSlug: string;
  let uploadPaletteId: string;
  let aiPaletteId: string;
  let pendingAiPaletteId: string;
  let rtxApprovedPaletteId: string;
  let rtxPendingPaletteId: string;
  let rtxPngFallbackPaletteId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-export-"));
    worldSlug = "export-test";

    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Export Test",
      slug: worldSlug,
      description: "Test world for static export",
    });

    await repo.createPage({
      worldId: world.id,
      title: "Validori",
      slug: "validori",
      type: "location",
      summary: "Hafenstadt",
      visibility: "public",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "public",
          content: "Validori liegt an der Küste. Mehr über [[Arbor|den Wald]].",
        },
        {
          type: "gm_note",
          sortOrder: 1,
          visibility: "dm_only",
          content: "Geheime GM-Notiz über [[Shagottar]].",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Arbor",
      slug: "arbor",
      type: "region",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Der Wald Arbor grenzt an [[Validori]].",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Shagottar",
      slug: "shagottar",
      type: "location",
      visibility: "dm_only",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "dm_only",
          content: "Geheime Festung Shagottar.",
        },
      ],
    });

    const db = createPrismaClient(databaseUrl);
    const atlas = createAtlasService(db);
    const map = await atlas.getOrCreateAtlasForWorld(world.id);
    await atlas.updateAtlasMap(map.id, {
      visibility: "player_visible",
      tileLayer: {
        cols: 2,
        rows: 2,
        tile: 32,
        cells: { "0,0": "forest", "1,0": "grassland" },
        intensity: { forest: 1.35, grassland: 0.8 },
        blendWidth: 6,
      },
    });
    const westland = await atlas.createNode({
      mapId: map.id,
      level: "continent",
      title: "Westland",
      visibility: "player_visible",
    });
    await atlas.createNode({
      mapId: map.id,
      level: "continent",
      title: "Geheimland",
      visibility: "dm_only",
    });
    const treePalette = await db.atlasPaletteItem.findFirstOrThrow({
      where: { worldId: null, builtinGlyphKey: "tree" },
    });
    const uploadPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "Custom Banner",
      kind: "landmark",
      source: "upload",
      reviewStatus: "approved",
      styleTags: { imageData: CUSTOM_STAMP_PNG, mimeType: "image/png" },
    });
    uploadPaletteId = uploadPalette.id;
    const aiPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "AI Crystal Obelisk",
      kind: "landmark",
      source: "ai",
      reviewStatus: "approved",
      styleTags: { imageData: AI_STAMP_PNG, mimeType: "image/png", prompt: "crystal obelisk" },
    });
    aiPaletteId = aiPalette.id;
    const pendingAiPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "Pending AI Secret Gate",
      kind: "landmark",
      source: "ai",
      reviewStatus: "pending",
      styleTags: { imageData: PENDING_AI_STAMP_PNG, mimeType: "image/png", prompt: "secret gate" },
    });
    pendingAiPaletteId = pendingAiPalette.id;
    const rtxApprovedPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "RTX Wachturm",
      kind: "rtx_asset",
      source: "ai",
      reviewStatus: "approved",
      styleTags: { proposalKind: "atlas_asset_proposal", rtxAssetProposal: rtxProposal("RTX Wachturm") },
    });
    rtxApprovedPaletteId = rtxApprovedPalette.id;
    const rtxPendingPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "RTX Pending Obelisk",
      kind: "rtx_asset",
      source: "ai",
      reviewStatus: "pending",
      styleTags: { proposalKind: "atlas_asset_proposal", rtxAssetProposal: rtxProposal("RTX Pending Obelisk") },
    });
    rtxPendingPaletteId = rtxPendingPalette.id;
    const rtxPngFallbackPalette = await atlas.createPaletteItem({
      worldId: world.id,
      name: "RTX PNG Fallback",
      kind: "rtx_asset",
      source: "ai",
      reviewStatus: "approved",
      styleTags: { proposalKind: "atlas_asset_proposal", rtxAssetProposal: RTX_PNG_FALLBACK_PROPOSAL },
    });
    rtxPngFallbackPaletteId = rtxPngFallbackPalette.id;
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: treePalette.id,
      x: 0.35,
      y: 0.45,
      scale: 1.1,
      rotation: 8,
      style: { gouache: "g_keep", lineWidth: 1.8, blur: 0.4 },
      layer: 50,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: uploadPalette.id,
      x: 0.55,
      y: 0.45,
      scale: 0.9,
      rotation: -6,
      layer: 55,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: aiPalette.id,
      x: 0.65,
      y: 0.42,
      scale: 1.2,
      rotation: 3,
      layer: 56,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: pendingAiPalette.id,
      x: 0.75,
      y: 0.4,
      scale: 1,
      rotation: 0,
      layer: 57,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: rtxApprovedPalette.id,
      x: 0.45,
      y: 0.52,
      scale: 1.1,
      rotation: 5,
      layer: 58,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: rtxPendingPalette.id,
      x: 0.5,
      y: 0.52,
      scale: 1,
      rotation: 0,
      layer: 59,
      visibility: "player_visible",
    });
    await atlas.createObject({
      nodeId: westland.id,
      paletteItemId: rtxPngFallbackPalette.id,
      x: 0.55,
      y: 0.52,
      scale: 1,
      rotation: 0,
      layer: 60,
      visibility: "player_visible",
    });
    await db.$disconnect();
  });

  after(async () => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("exports portal-visible pages to HTML files", async () => {
    const repo = createUweRepository(databaseUrl);
    const result = await exportWorldStatic(repo, {
      worldSlug,
      outputDir,
    });

    assert.equal(result.pageCount, 2);
    assert.ok(fs.existsSync(path.join(outputDir, "index.html")));
    assert.ok(fs.existsSync(path.join(outputDir, "locations/validori/index.html")));
    assert.ok(fs.existsSync(path.join(outputDir, "locations/arbor/index.html")));
    assert.ok(fs.existsSync(path.join(outputDir, "search-index.json")));
    assert.ok(fs.existsSync(path.join(outputDir, "assets/portal.css")));
    assert.ok(fs.existsSync(path.join(outputDir, "assets/search.js")));
  });

  it("does not include dm-only content in export", async () => {
    const repo = createUweRepository(databaseUrl);
    await exportWorldStatic(repo, { worldSlug, outputDir: path.join(outputDir, "audit") });

    const exportRoot = path.join(outputDir, "audit");
    const validoriHtml = fs.readFileSync(
      path.join(exportRoot, "locations/validori/index.html"),
      "utf8",
    );
    const searchIndex = fs.readFileSync(
      path.join(exportRoot, "search-index.json"),
      "utf8",
    );

    assert.ok(!validoriHtml.includes("Geheime GM-Notiz"));
    assert.ok(!validoriHtml.includes("Shagottar"));
    assert.ok(!searchIndex.includes("Shagottar"));
    assert.ok(!fs.existsSync(path.join(exportRoot, "locations/shagottar/index.html")));
  });

  it("rewrites internal links to working relative paths", async () => {
    const repo = createUweRepository(databaseUrl);
    const exportRoot = path.join(outputDir, "links");
    await exportWorldStatic(repo, { worldSlug, outputDir: exportRoot });

    const validoriHtml = fs.readFileSync(
      path.join(exportRoot, "locations/validori/index.html"),
      "utf8",
    );
    const arborHtml = fs.readFileSync(
      path.join(exportRoot, "locations/arbor/index.html"),
      "utf8",
    );

    assert.match(validoriHtml, /href="\.\.\/arbor\/"/);
    assert.match(arborHtml, /href="\.\.\/validori\/"/);
  });

  it("bundles CSS and JS assets", async () => {
    const repo = createUweRepository(databaseUrl);
    const exportRoot = path.join(outputDir, "assets-test");
    const result = await exportWorldStatic(repo, { worldSlug, outputDir: exportRoot });

    assert.ok(result.assetCount >= 2);
    const css = fs.readFileSync(path.join(exportRoot, "assets/portal.css"), "utf8");
    const js = fs.readFileSync(path.join(exportRoot, "assets/search.js"), "utf8");
    assert.ok(css.includes(".uwe-shell"));
    assert.ok(js.includes("data-static-search"));
  });

  it("maps portal URLs to static export paths", () => {
    assert.equal(
      portalUrlToStaticHref("/worlds/export-test/orte/validori", worldSlug),
      "locations/validori/",
    );
    assert.equal(
      relativeHref("locations/validori", "locations/arbor/"),
      "../arbor/",
    );
  });

  it("exports portal-filtered atlas bundle when databaseUrl is set", async () => {
    const repo = createUweRepository(databaseUrl);
    const exportRoot = path.join(outputDir, "atlas-json");
    const result = await exportWorldStatic(repo, {
      worldSlug,
      outputDir: exportRoot,
      databaseUrl,
    });
    const files = result.files.map((file) => file.replace(/\\/g, "/"));

    assert.ok(files.includes("atlas/data.json"));
    assert.ok(files.includes("atlas/index.html"));
    assert.ok(files.includes("atlas/atlas-viewer.js"));
    assert.ok(files.includes("atlas/atlas-engine.js"));

    const atlasJson = JSON.parse(
      fs.readFileSync(path.join(exportRoot, "atlas/data.json"), "utf8"),
    ) as {
      nodes: { title: string }[];
      tileLayer: { intensity?: Record<string, number>; blendWidth?: number } | null;
      preset: { colors: { parchment: string } };
      builtinGlyphs: { key: string; pathData: string }[];
      paletteItems: Record<
        string,
        {
          source: string;
          builtinGlyphKey: string | null;
          imageData?: string;
          mimeType?: string;
          recipe?: unknown;
        }
      >;
      objects: {
        paletteItemId: string;
        style: { gouache?: string; lineWidth?: number; blur?: number } | null;
      }[];
    };
    assert.equal(atlasJson.nodes.length, 1);
    assert.equal(atlasJson.nodes[0]?.title, "Westland");
    assert.equal(atlasJson.tileLayer?.intensity?.forest, 1.35);
    assert.equal(atlasJson.tileLayer?.blendWidth, 6);
    assert.equal(atlasJson.objects[0]?.style?.gouache, "g_keep");
    assert.equal(atlasJson.objects[0]?.style?.lineWidth, 1.8);
    assert.equal(atlasJson.objects[0]?.style?.blur, 0.4);
    assert.deepEqual(atlasJson.paletteItems[uploadPaletteId], {
      source: "upload",
      builtinGlyphKey: null,
      imageData: CUSTOM_STAMP_PNG,
      mimeType: "image/png",
    });
    assert.deepEqual(atlasJson.paletteItems[aiPaletteId], {
      source: "ai",
      builtinGlyphKey: null,
      imageData: AI_STAMP_PNG,
      mimeType: "image/png",
    });
    assert.equal(atlasJson.paletteItems[pendingAiPaletteId], undefined);
    assert.equal(
      atlasJson.objects.some((object) => object.paletteItemId === pendingAiPaletteId),
      false,
    );
    assert.ok(!JSON.stringify(atlasJson).includes(PENDING_AI_STAMP_PNG));
    // Approved custom/AI stamps: placed objects stay visible in the payload …
    assert.ok(atlasJson.objects.some((object) => object.paletteItemId === uploadPaletteId));
    assert.ok(atlasJson.objects.some((object) => object.paletteItemId === aiPaletteId));
    // … but AI-stamp styleTags metadata (e.g. the generation text) never ships.
    assert.ok(!JSON.stringify(atlasJson).includes("crystal obelisk"));
    assert.ok(atlasJson.preset.colors.parchment);

    // Canonical pictogram registry is injected so the static viewer needs no copy.
    assert.ok(atlasJson.builtinGlyphs.length >= 20);
    assert.ok(atlasJson.builtinGlyphs.every((g) => g.key && g.pathData));

    const viewerJs = fs.readFileSync(path.join(exportRoot, "atlas/atlas-viewer.js"), "utf8");
    assert.match(viewerJs, /atlas-engine\.js/);
    assert.match(viewerJs, /drawGouacheAsset/);
    assert.match(viewerJs, /buildVineLayout/);
    assert.match(viewerJs, /drawVine/);
    assert.match(viewerJs, /smoothPath/);
    assert.match(viewerJs, /blendWidth/);
    assert.match(viewerJs, /data-atlas-legend/);

    const indexHtml = fs.readFileSync(path.join(exportRoot, "index.html"), "utf8");
    assert.match(indexHtml, /Atlas \/ Karte öffnen/);
    const atlasHtml = fs.readFileSync(path.join(exportRoot, "atlas/index.html"), "utf8");
    assert.match(atlasHtml, /\.atlas-static-legend/);
  });

  it("exports approved RTX assets as validated recipe-only palette items", async () => {
    const repo = createUweRepository(databaseUrl);
    const exportRoot = path.join(outputDir, "atlas-rtx");
    await exportWorldStatic(repo, { worldSlug, outputDir: exportRoot, databaseUrl });

    const atlasJson = JSON.parse(
      fs.readFileSync(path.join(exportRoot, "atlas/data.json"), "utf8"),
    ) as {
      paletteItems: Record<
        string,
        { source: string; builtinGlyphKey: string | null; imageData?: string; recipe?: unknown }
      >;
      objects: { paletteItemId: string }[];
    };

    // Approved json-recipe item: exactly source + glyph key + validated recipe.
    assert.deepEqual(atlasJson.paletteItems[rtxApprovedPaletteId], {
      source: "ai",
      builtinGlyphKey: null,
      recipe: RTX_RECIPE,
    });
    assert.ok(
      atlasJson.objects.some((object) => object.paletteItemId === rtxApprovedPaletteId),
      "approved RTX object must stay visible",
    );

    // Pending rtx_asset items never reach the export — item and object are gone.
    assert.equal(atlasJson.paletteItems[rtxPendingPaletteId], undefined);
    assert.equal(
      atlasJson.objects.some((object) => object.paletteItemId === rtxPendingPaletteId),
      false,
    );

    // png-fallback proposals have no safe render path — excluded like invalid items.
    assert.equal(atlasJson.paletteItems[rtxPngFallbackPaletteId], undefined);
    assert.equal(
      atlasJson.objects.some((object) => object.paletteItemId === rtxPngFallbackPaletteId),
      false,
    );

    // Review-only proposal metadata must never appear anywhere in the payload.
    const serialized = JSON.stringify(atlasJson);
    assert.ok(!serialized.includes("rtx-geheimer-prompt"));
    assert.ok(!serialized.includes("rtx-geheime-begruendung"));
    assert.ok(!serialized.includes("rtx-geheime-styleguide-notiz"));
    assert.ok(!serialized.includes("rtx-geheim-tag"));
    assert.ok(!serialized.includes("rtxAssetProposal"));
    assert.ok(!serialized.includes("pngFallback"));
  });
});
