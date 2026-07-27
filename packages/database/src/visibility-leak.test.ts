import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  isPlayerExposableContent,
  sanitizeForPlayer,
} from "./content-access";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { buildPublicSearchIndex, buildStudioSearchIndex } from "./search-index";
import { searchIndex } from "./search-service";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("visibility and secret leak protection", () => {
  let databaseUrl: string;
  let repo: ReturnType<typeof createUweRepository>;
  let worldId: string;
  const worldSlug = "leak-test";

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Leak Test World",
      slug: worldSlug,
    });
    worldId = world.id;

    await repo.createPage({
      worldId,
      title: "Veröffentlichte Spielerseite",
      slug: "spieler-seite",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Spieler sehen das.",
        },
        {
          type: "gm_note",
          sortOrder: 1,
          visibility: "dm_only",
          content: "DM NOTE: geheime Wahrheit",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Entwurf sichtbar",
      slug: "entwurf-sichtbar",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "draft",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Noch nicht live.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Verstecktes Geheimnis",
      slug: "geheimnis",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Noch verborgen.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Enthülltes Geheimnis",
      slug: "enthuellt",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Spoiler ist enthüllt.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Block-Geheimnisse",
      slug: "block-geheimnisse",
      type: "lore",
      visibility: "player_visible",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Sichtbarer Block.",
        },
        {
          type: "rich_text",
          sortOrder: 1,
          visibility: "player_visible",
          content: "GEHEIMER BLOCK verborgen.",
        },
        {
          type: "rich_text",
          sortOrder: 2,
          visibility: "player_visible",
          content: "Enthuellter Block-Spoiler.",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Privater Plot",
      slug: "privater-plot",
      type: "lore",
      visibility: "private",
      publishStatus: "published",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "private",
          content: "Nur DM.",
        },
      ],
    });

    await db.$disconnect();
  });

  it("sanitizeForPlayer removes DM notes and admin metadata", async () => {
    const page = await repo.getPageBySlug(worldSlug, "spieler-seite");
    assert.ok(page);

    const sanitized = sanitizeForPlayer(page);
    const joined = sanitized.contentBlocks.map((block) => block.content).join("\n");

    assert.ok(joined.includes("Spieler sehen das."));
    assert.ok(!joined.includes("DM NOTE"));
    assert.equal(sanitized.contentBlocks.every((block) => block.type !== "gm_note"), true);
  });



  it("public search index excludes private and unpublished content", async () => {
    const db = createPrismaClient(databaseUrl);
    const pages = await db.page.findMany({
      where: { world: { slug: worldSlug } },
      include: {
        contentBlocks: { orderBy: { sortOrder: "asc" } },
        world: { select: { slug: true, name: true } },
        campaign: { select: { name: true } },
      },
    });

    const publicIndex = buildPublicSearchIndex(pages);
    const studioIndex = buildStudioSearchIndex(pages);

    assert.ok(publicIndex.length < studioIndex.length);
    assert.ok(!publicIndex.some((entry) => entry.slug === "privater-plot"));
    assert.ok(!publicIndex.some((entry) => entry.slug === "entwurf-sichtbar"));
    assert.ok(publicIndex.some((entry) => entry.slug === "geheimnis"));
    assert.ok(publicIndex.some((entry) => entry.slug === "spieler-seite"));
    assert.ok(publicIndex.some((entry) => entry.slug === "enthuellt"));

    const privateHits = searchIndex(publicIndex, { query: "Nur DM", worldSlug });
    assert.equal(privateHits.length, 0);

    await db.$disconnect();
  });

  it("player portal API excludes drafts and private pages", async () => {
    assert.ok(await repo.getPublicPageForPortal(worldSlug, "spieler-seite"));
    assert.equal(await repo.getPublicPageForPortal(worldSlug, "entwurf-sichtbar"), null);
    assert.ok(await repo.getPublicPageForPortal(worldSlug, "geheimnis"));
    assert.equal(await repo.getPublicPageForPortal(worldSlug, "privater-plot"), null);
    assert.ok(await repo.getPublicPageForPortal(worldSlug, "enthuellt"));
  });


  it("central exposure rules match acceptance criteria", () => {
    // Visibility and publish status are the whole rule now — secret level and
    // reveal state were removed, so a published player-facing page is exposable
    // and nothing else about the page can hold it back.
    assert.equal(
      isPlayerExposableContent({ visibility: "player_visible", publishStatus: "published" }),
      true,
    );
    assert.equal(
      isPlayerExposableContent({ visibility: "public", publishStatus: "published" }),
      true,
    );

    for (const publishStatus of ["draft", "internal", "review", "archived"] as const) {
      assert.equal(
        isPlayerExposableContent({ visibility: "player_visible", publishStatus }),
        false,
        `${publishStatus} must not be exposable`,
      );
    }

    for (const visibility of ["dm_only", "private", "archived"] as const) {
      assert.equal(
        isPlayerExposableContent({ visibility, publishStatus: "published" }),
        false,
        `${visibility} must not be exposable`,
      );
    }
  });

  it("private media is not publicly accessible without a signature", async () => {
    const db = createPrismaClient(databaseUrl);
    const auth = createAuthService(db);

    const asset = await repo.createAsset({
      worldId,
      title: "Private Map",
      type: "map",
      storageKey: "leak-test/private-map.png",
      mimeType: "image/png",
      size: 12,
      visibility: "private",
    });

    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);

    const visible = await auth.getAssetForViewer(worldSlug, asset.id, ctx!);
    assert.equal(visible, null);

    await db.$disconnect();
  });
});
