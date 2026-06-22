import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createUweRepository } from "@uwe/database/server";
import {
  executeImport,
  mapEntityToPageDraft,
  mapKnoteForgeTypeToPageType,
  parseImportContent,
  previewFromContent,
  previewImport,
} from "./index";
import type { NormalizedImportBundle } from "./types";

const SAMPLE_EXPORT = JSON.stringify({
  version: "1.0",
  source: "knoteforge",
  exportedAt: "2026-06-11T12:00:00.000Z",
  entities: [
    {
      id: "kf-dungeon-1",
      type: "dungeon",
      title: "Die Verlorene Mine",
      slug: "verlorene-mine",
      content: "Eine alte Zwergenmine voller Gefahren.",
      gmContent: "Geheime Falle in Raum 3.",
    },
    {
      id: "kf-room-1",
      type: "raum",
      title: "Eingangshalle",
      slug: "eingangshalle",
      content: "Staubige Steinbögen.",
    },
    {
      type: "spieler_notiz",
      title: "Spielerhinweis",
      slug: "spielerhinweis",
      content: "Ihr seht Fackeln an der Wand.",
    },
    {
      type: "wissenstext",
      title: "Die Verlorene Mine",
      slug: "verlorene-mine-dup",
      content: "Duplikat-Titel Test.",
    },
    {
      type: "encounter",
      title: "",
      slug: "leer",
    },
    {
      type: "unknown_type",
      title: "Unbekannter Typ",
      slug: "unbekannt",
    },
  ],
  assets: [
    { id: "a1", filename: "map.png", hash: "abc123" },
    { id: "a2", filename: "map.png", hash: "def456" },
  ],
});

function buildBundle(overrides?: Partial<NormalizedImportBundle>): NormalizedImportBundle {
  const { bundle } = parseImportContent("json", SAMPLE_EXPORT);
  return { ...bundle, ...overrides };
}

describe("KnoteForge import", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    const { createPrismaClient } = await import("@uwe/database/server");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("maps KnoteForge types to UWE page types", () => {
    assert.equal(mapKnoteForgeTypeToPageType("dungeon"), "dungeon");
    assert.equal(mapKnoteForgeTypeToPageType("ebene"), "dungeon_level");
    assert.equal(mapKnoteForgeTypeToPageType("raum"), "room");
    assert.equal(mapKnoteForgeTypeToPageType("spieler_notiz"), "note");
    assert.equal(mapKnoteForgeTypeToPageType("unknown"), "note");
  });

  it("maps entities to page drafts with correct blocks", () => {
    const draft = mapEntityToPageDraft({
      id: "kf-1",
      type: "dungeon",
      title: "Test",
      content: "Body",
      gmContent: "Secret",
    });

    assert.equal(draft.type, "dungeon");
    assert.equal(draft.contentBlocks.length, 2);
    assert.equal(draft.contentBlocks[0]?.type, "rich_text");
    assert.equal(draft.contentBlocks[1]?.type, "gm_note");
    assert.ok(draft.tags.some((tag) => tag === "kf-import:kf-1"));
  });

  it("parses valid JSON export", () => {
    const { bundle, validationErrors } = parseImportContent("json", SAMPLE_EXPORT);
    assert.equal(bundle.entities.length, 6);
    assert.equal(bundle.assets.length, 2);
    assert.equal(validationErrors.length, 0);
  });

  it("parses KnoteForge Eingang JSON array export", () => {
    const eingangExport = JSON.stringify([
      {
        id: 12,
        title: "Dungeon-Idee",
        source: "manual",
        status: "new",
        priority: "high",
        raw_text: "Eine verlassene Zwergenmine mit Falle.",
        created_at: "2026-06-11T10:00:00.000Z",
        updated_at: "2026-06-11T10:05:00.000Z",
      },
      {
        id: 13,
        title: "",
        source: "file:md",
        status: "review",
        priority: "normal",
        raw_text: "Spielerhinweis\n\nIhr seht Fackeln an der Wand.",
        structured_preview: "Strukturierte Vorschau für den SL.",
        created_at: "2026-06-11T11:00:00.000Z",
        updated_at: "2026-06-11T11:10:00.000Z",
      },
    ]);

    const { bundle, validationErrors } = parseImportContent("json", eingangExport);
    assert.equal(validationErrors.length, 0);
    assert.equal(bundle.entities.length, 2);
    assert.equal(bundle.entities[0]?.id, "eingang-12");
    assert.equal(bundle.entities[0]?.type, "session_notiz");
    assert.equal(bundle.entities[0]?.title, "Dungeon-Idee");
    assert.equal(bundle.entities[0]?.content, "Eine verlassene Zwergenmine mit Falle.");
    assert.equal(bundle.entities[1]?.title, "Spielerhinweis");
    assert.equal(bundle.entities[1]?.gmContent, "Strukturierte Vorschau für den SL.");
  });

  it("rejects unknown JSON array formats", () => {
    assert.throws(
      () => parseImportContent("json", JSON.stringify([1, 2, 3])),
      /nicht im erkannten KnoteForge-Eingang-Format/,
    );
  });

  it("does not crash on invalid JSON", () => {
    assert.throws(
      () => parseImportContent("json", "{ invalid"),
      /JSON konnte nicht geparst werden/,
    );
  });

  it("preview does not modify database", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Import Test",
      slug: "import-test",
      description: "Testwelt",
    });

    const pagesBefore = await repo.listPagesByWorld("import-test");
    assert.equal(pagesBefore.length, 0);

    const preview = await previewFromContent(
      repo,
      "json",
      SAMPLE_EXPORT,
      "import-test",
    );

    const pagesAfter = await repo.listPagesByWorld("import-test");
    assert.equal(pagesAfter.length, 0);
    assert.equal(preview.totalEntities, 6);
    assert.ok(preview.items.length > 0);
    assert.equal(preview.summary.new, 3);
    assert.equal(preview.summary.duplicate, 2);
    assert.equal(preview.summary.skipped, 1);
    assert.ok(preview.summary.conflict >= 0);
    assert.ok(world.id);
  });

  it("detects slug conflicts and resolves them on import", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({
      name: "Slug Test",
      slug: "slug-test",
      description: "Test",
    });

    await repo.createPage({
      worldId: (await repo.getWorldBySlug("slug-test"))!.id,
      title: "Bestehend",
      slug: "eingangshalle",
      type: "room",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, content: "Alt", visibility: "dm_only" },
      ],
    });

    const bundle = buildBundle({
      entities: [
        {
          id: "new-room",
          type: "raum",
          title: "Neuer Raum",
          slug: "eingangshalle",
          content: "Neu",
        },
      ],
    });

    const preview = await previewImport(repo, bundle, {
      worldSlug: "slug-test",
      format: "json",
    });

    assert.equal(preview.items[0]?.status, "conflict");
    assert.notEqual(preview.items[0]?.resolvedSlug, "eingangshalle");

    const result = await executeImport(repo, bundle, "slug-test", "json", {
      confirmed: true,
      autoResolveSlugConflicts: true,
    });

    assert.equal(result.created, 1);
    assert.notEqual(result.items[0]?.slug, "eingangshalle");

    const pages = await repo.listPagesByWorld("slug-test");
    assert.equal(pages.length, 2);
  });

  it("creates pages correctly on execute", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({
      name: "Execute Test",
      slug: "execute-test",
      description: "Test",
    });

    const bundle = buildBundle({
      entities: [
        {
          id: "kf-exec-1",
          type: "dungeon",
          title: "Import Dungeon",
          slug: "import-dungeon",
          content: "Dungeon Inhalt",
        },
      ],
    });

    const result = await executeImport(repo, bundle, "execute-test", "json", {
      confirmed: true,
    });

    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.ok(result.log.length >= 2);
    assert.ok(result.log.some((entry) => entry.status === "new" && entry.message.includes("erstellt")));

    const page = await repo.getPageBySlug("execute-test", "import-dungeon");
    assert.ok(page);
    assert.equal(page.title, "Import Dungeon");
    assert.equal(page.type, "dungeon");
    assert.equal(page.contentBlocks.length, 1);
    assert.equal(page.contentBlocks[0]?.content, "Dungeon Inhalt");

    const metadata = page.contentBlocks[0]?.metadata as Record<string, unknown>;
    assert.equal(metadata.source, "knoteforge");
    assert.equal(metadata.knoteforgeId, "kf-exec-1");
  });

  it("detects duplicates by title", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({
      name: "Dup Test",
      slug: "dup-test",
      description: "Test",
    });

    const preview = await previewFromContent(repo, "json", SAMPLE_EXPORT, "dup-test");

    const duplicateItem = preview.items.find((item) => item.status === "duplicate");
    assert.ok(duplicateItem);
    assert.equal(duplicateItem.title, "Die Verlorene Mine");
    assert.ok(duplicateItem.conflicts.some((c) => c.kind === "title"));
  });

  it("skips invalid entities without crashing", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({
      name: "Invalid Test",
      slug: "invalid-test",
      description: "Test",
    });

    const malformed = JSON.stringify({
      version: "1.0",
      source: "knoteforge",
      entities: [
        { type: "dungeon", title: "OK", slug: "ok-page", content: "Fine" },
        { type: "raum", title: "   ", slug: "bad" },
      ],
    });

    const { bundle: lenientBundle } = parseImportContent("json", malformed);
    assert.equal(lenientBundle.entities.length, 2);

    const lenientPreview = await previewImport(
      repo,
      lenientBundle,
      { worldSlug: "invalid-test", format: "json" },
    );
    assert.equal(lenientPreview.summary.skipped, 1);

    const bundle = buildBundle({
      entities: [
        { id: "ok", type: "dungeon", title: "OK", slug: "ok", content: "x" },
        { id: "bad", type: "raum", title: "Noch OK", slug: "bad" },
      ],
    });

    const result = await executeImport(repo, bundle, "invalid-test", "json", {
      confirmed: true,
    });

    assert.equal(result.created, 2);
    assert.equal(result.failed, 0);
  });

  it("requires confirmation for execute", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Confirm", slug: "confirm-test" });
    const bundle = buildBundle({
      entities: [
        { id: "c1", type: "note", title: "Note", slug: "note-1", content: "x" },
      ],
    });

    await assert.rejects(
      () =>
        executeImport(repo, bundle, "confirm-test", "json", {
          confirmed: false,
        }),
      /confirmed/,
    );
  });

  it("detects asset filename duplicates in preview", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Asset", slug: "asset-test" });

    const preview = await previewFromContent(repo, "json", SAMPLE_EXPORT, "asset-test");
    assert.ok(preview.errors.some((e) => e.includes("map.png")));
  });

  it("records error status for failed items without crashing", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({
      name: "Error Test",
      slug: "error-test",
      description: "Test",
    });

    const bundle = buildBundle({
      entities: [
        {
          id: "bad-page",
          type: "dungeon",
          title: "Bad Page",
          slug: "bad-page",
          content: "x",
        },
      ],
    });

    const originalCreate = repo.createPage.bind(repo);
    repo.createPage = async () => {
      throw new Error("Simulierter DB-Fehler");
    };

    const result = await executeImport(repo, bundle, "error-test", "json", {
      confirmed: true,
    });

    repo.createPage = originalCreate;

    assert.equal(result.failed, 1);
    assert.equal(result.items[0]?.status, "error");
    assert.equal(result.log.some((entry) => entry.status === "error"), true);

    const pages = await repo.listPagesByWorld("error-test");
    assert.equal(pages.length, 0);
  });
});
