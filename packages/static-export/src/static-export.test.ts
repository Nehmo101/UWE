import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createUweRepository, createAtlasService, createPrismaClient } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { exportWorldStatic } from "./export-world";
import { portalUrlToStaticHref, relativeHref } from "./paths";

describe("static export", () => {
  let databaseUrl: string;
  let outputDir: string;
  let worldSlug: string;

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
    await atlas.updateAtlasMap(map.id, { visibility: "player_visible" });
    await atlas.createNode({
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

    assert.ok(result.files.includes("atlas/data.json"));
    assert.ok(result.files.includes("atlas/index.html"));
    assert.ok(result.files.includes("atlas/atlas-viewer.js"));

    const atlasJson = JSON.parse(
      fs.readFileSync(path.join(exportRoot, "atlas/data.json"), "utf8"),
    ) as { nodes: { title: string }[]; preset: { colors: { parchment: string } } };
    assert.equal(atlasJson.nodes.length, 1);
    assert.equal(atlasJson.nodes[0]?.title, "Westland");
    assert.ok(atlasJson.preset.colors.parchment);

    const indexHtml = fs.readFileSync(path.join(exportRoot, "index.html"), "utf8");
    assert.match(indexHtml, /Atlas \/ Karte öffnen/);
  });
});
