import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";

import { buildDocImportPlan } from "./plan";
import { writeDocImport } from "./writer";

/**
 * Ein Kampagnenband beschreibt zwangsläufig Personen, die die Welt schon kennt.
 * Bis hierher legte der Import für jede eine zweite Seite an — beim Band
 * *Dunkelsonne* waren das 22 Doppelungen, darunter eine Spielerfigur. Jetzt
 * wandert der Abschnitt in die bestehende Seite.
 */
const BAND = [
  "---",
  "titel: Ein Band",
  "typ: lore",
  "---",
  "",
  "# Ein Band",
  "",
  // Jeder Abschnitt muss über 1.400 Zeichen tragen, sonst faltet ihn der Import
  // in seine Elternseite ein und es gäbe gar nichts zu verschmelzen (FORMAT §2.6).
  "Der Rahmen des Bandes, lang genug für eine eigene Seite. ".repeat(30),
  "",
  "## Nepurga",
  "",
  "Was der Band über sie zu sagen hat, und zwar reichlich. ".repeat(30),
  "",
  "### Ihr Hof",
  "",
  "Eine Unterseite, die an Nepurga hängen muss. ".repeat(40),
  "",
  "## Eine ganz neue Person",
  "",
  "Die es in der Welt noch nicht gibt, mit genug Text für eine Seite. ".repeat(30),
].join("\n");

function plan(existingSlugs: string[]) {
  return buildDocImportPlan([{ fileName: "band.md", content: BAND }], {
    mode: "document",
    profile: "campaign_book",
    existingSlugs,
    worldName: "Testwelt",
    worldSlug: "testwelt",
    roleHints: new Map(),
    knownEntities: [],
  });
}

describe("writeDocImport ergänzt bestehende Seiten", () => {
  let repo: ReturnType<typeof createUweRepository>;
  let worldId: string;
  let nepurgaId: string;

  before(async () => {
    repo = createUweRepository(createTestDatabaseUrl());
    const world = await repo.createWorld({ name: "Testwelt", slug: "testwelt", description: "" });
    worldId = world.id;

    const page = await repo.createPage({
      worldId,
      title: "Nepurga",
      slug: "nepurga",
      type: "npc",
      canonicalStatus: "canon",
      aliases: ["Neru"],
      contentBlocks: [{ type: "rich_text", sortOrder: 0, content: "<p>Die gepflegte Weltseite.</p>" }],
    });
    nepurgaId = page.id;
  });

  it("legt keine zweite Seite an, sondern hängt einen Abschnitt an", async () => {
    const p = plan(["nepurga"]);
    const result = await writeDocImport(repo, p.pages, p.relations, {
      worldSlug: "testwelt",
      confirmed: true,
    });

    assert.equal(result.merged, 1, "genau ein Entwurf sollte verschmelzen");
    assert.equal(result.failed, 0);

    const alle = await repo.listPagesByWorld("testwelt");
    const nepurgas = alle.filter((page) => page.title.toLocaleLowerCase("de").includes("nepurga"));
    assert.equal(nepurgas.length, 1, `es darf nur eine Nepurga geben, gefunden: ${nepurgas.map((n) => n.slug).join(", ")}`);

    const page = await repo.getPageById(nepurgaId);
    assert.ok(page);
    assert.equal(page.contentBlocks.length, 2, "der Abschnitt muss dazugekommen sein");
    assert.match(page.contentBlocks[0].content, /gepflegte Weltseite/, "der alte Text bleibt vorn");
    assert.match(page.contentBlocks[1].content, /<h2>Nepurga<\/h2>/, "der neue Abschnitt trägt seine Überschrift");
  });

  it("lässt Typ, Kanon-Status und Slug der bestehenden Seite in Ruhe", async () => {
    const page = await repo.getPageById(nepurgaId);
    assert.ok(page);
    assert.equal(page.type, "npc", "eine Weltseite wird nicht zum Bandtyp umgebogen");
    assert.equal(page.canonicalStatus, "canon", "und nicht zum Entwurf zurückgestuft");
    assert.equal(page.slug, "nepurga");
  });

  it("hängt die Unterseite an die bestehende Seite, nicht ins Leere", async () => {
    const alle = await repo.listPagesByWorld("testwelt");
    const hof = alle.find((page) => page.title === "Ihr Hof");
    assert.ok(hof, "die Unterseite muss angelegt worden sein");
    assert.equal(hof.parentPageId, nepurgaId, "sie gehört unter die bestehende Nepurga");
  });

  it("legt neue Namen weiterhin als eigene Seite an", async () => {
    const alle = await repo.listPagesByWorld("testwelt");
    assert.ok(alle.some((page) => page.title === "Eine ganz neue Person"));
  });

  it("hängt beim zweiten Lauf nichts doppelt an", async () => {
    const vorher = (await repo.getPageById(nepurgaId))!.contentBlocks.length;

    const p = plan(["nepurga"]);
    const result = await writeDocImport(repo, p.pages, p.relations, {
      worldSlug: "testwelt",
      confirmed: true,
    });

    const nachher = (await repo.getPageById(nepurgaId))!.contentBlocks.length;
    assert.equal(nachher, vorher, "ein zweiter Import darf die Seite nicht wachsen lassen");
    assert.ok(
      result.warnings.some((w) => w.includes("früheren Lauf")),
      "und er soll sagen, dass er nichts getan hat",
    );
  });

  it("liefert dem Rückbau den Zustand von vorher", async () => {
    const zweite = createUweRepository(createTestDatabaseUrl());
    const world = await zweite.createWorld({ name: "Zweite", slug: "zweite", description: "" });
    const page = await zweite.createPage({
      worldId: world.id,
      title: "Nepurga",
      slug: "nepurga",
      type: "npc",
      aliases: ["Neru"],
      contentBlocks: [{ type: "rich_text", sortOrder: 0, content: "<p>Vorher.</p>" }],
    });

    const p = buildDocImportPlan([{ fileName: "band.md", content: BAND }], {
      mode: "document",
      profile: "campaign_book",
      existingSlugs: ["nepurga"],
      worldName: "Zweite",
      worldSlug: "zweite",
      roleHints: new Map(),
      knownEntities: [],
    });
    const result = await writeDocImport(zweite, p.pages, p.relations, {
      worldSlug: "zweite",
      confirmed: true,
    });

    assert.equal(result.undo.updatedPages.length, 1);
    const record = result.undo.updatedPages[0];
    assert.equal(record.pageId, page.id);
    assert.deepEqual(record.page.aliases, ["Neru"], "der Alias-Stand von vorher");
    assert.equal(record.previousBlockIds.length, 1);
    assert.equal(record.addedBlockIds.length, 1, "genau der eine Block, der dazukam");
  });

  it("mergeIntoExisting: false legt die alte Fassung wieder frei", async () => {
    const dritte = createUweRepository(createTestDatabaseUrl());
    const world = await dritte.createWorld({ name: "Dritte", slug: "dritte", description: "" });
    await dritte.createPage({
      worldId: world.id,
      title: "Nepurga",
      slug: "nepurga",
      type: "npc",
      contentBlocks: [{ type: "rich_text", sortOrder: 0, content: "<p>Vorher.</p>" }],
    });

    const p = buildDocImportPlan([{ fileName: "band.md", content: BAND }], {
      mode: "document",
      profile: "campaign_book",
      existingSlugs: ["nepurga"],
      worldName: "Dritte",
      worldSlug: "dritte",
      roleHints: new Map(),
      knownEntities: [],
    });
    const result = await writeDocImport(dritte, p.pages, p.relations, {
      worldSlug: "dritte",
      confirmed: true,
      mergeIntoExisting: false,
    });

    assert.equal(result.merged, 0);
    const alle = await dritte.listPagesByWorld("dritte");
    const nepurgas = alle.filter((page) => page.title.toLocaleLowerCase("de").includes("nepurga"));
    assert.equal(nepurgas.length, 2, "ohne den Schalter entsteht wieder eine zweite Seite");
  });
});
