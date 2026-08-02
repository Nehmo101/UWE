import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createUweRepository } from "@uwe/database/server";
import { buildDocImportPlan } from "./plan";
import { writeDocImport } from "./writer";

const PELLAR = `---
titel: Pellar Hopsenried
typ: nsc
status: kanon
kampagnen: [Turm, Himmelsrouten]
siehe_auch: [Ferlor, Xarza]
---

# Pellar Hopsenried

## Beschreibung

Bürgermeister von [[Ferlor]].
`;

const TURM = [
  "# DER MAGISTER-TURM",
  "Ein Dungeon.",
  "# TEIL C — DER TURM",
  "## C.1 EBENE 1 — Eingangsring",
  "Ein Foyer.",
  "### C.1.1 Die Räume",
  "- **Der Ring:** Ein Kreisgang um den Hohlkern.",
  "- **Die Wachstube:** Ein kaltes Kohlebecken.",
  "## C.2 EBENE 2 — Archiv",
  "Eine Bibliothek.",
].join("\n\n");

describe("writeDocImport", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    const { createPrismaClient } = await import("@uwe/database/client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("writes a bulk wiki page with campaign, status, tags and relations", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Terra", slug: "terra-bulk" });
    await repo.createCampaign({ worldId: world.id, name: "Turm", slug: "turm" });

    // Die Ziele von siehe_auch existieren bereits — die Kanten müssen greifen.
    await repo.createPage({ worldId: world.id, title: "Ferlor", slug: "ferlor", type: "location" });
    await repo.createPage({ worldId: world.id, title: "Xarza", slug: "xarza", type: "npc" });

    const plan = buildDocImportPlan([{ fileName: "pellar.md", content: PELLAR }], {
      mode: "wiki_pages",
      profile: "plain",
    });

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "terra-bulk",
      confirmed: true,
    });

    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.linksCreated, 2);

    const page = await repo.getPageBySlug("terra-bulk", "pellar-hopsenried");
    assert.ok(page);
    assert.equal(page.type, "npc");
    assert.equal(page.canonicalStatus, "canon");
    assert.equal(page.campaign?.slug, "turm", "erste bekannte Kampagne gewinnt");
    assert.deepEqual(page.tags, ["kampagne/turm", "kampagne/himmelsrouten"]);
    assert.equal(page.contentBlocks.length, 1);
    assert.ok(page.contentBlocks[0].content.includes("[[Ferlor]]"), "Wikilinks bleiben Text");
    assert.ok(page.contentBlocks[0].content.includes("<h2"), "Markdown wurde zu HTML");

    const links = await repo.listPageLinksForPage(page.id);
    assert.deepEqual(
      links.outgoing.map((link) => link.targetPage.slug).sort(),
      ["ferlor", "xarza"],
    );
  });

  it("writes a document as a real tree with reading order", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Validori", slug: "validori-doc" });

    const plan = buildDocImportPlan([{ fileName: "turm.md", content: TURM }], {
      mode: "document",
      profile: "dungeon",
    });

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "validori-doc",
      confirmed: true,
    });

    // Vier Gliederungsseiten plus die abgelegte Originaldatei.
    assert.equal(result.created, 6);

    const root = await repo.getPageBySlug("validori-doc", "der-magister-turm");
    const level1 = await repo.getPageBySlug("validori-doc", "ebene-1-eingangsring");
    const level2 = await repo.getPageBySlug("validori-doc", "ebene-2-archiv");
    const room = await repo.getPageBySlug("validori-doc", "der-ring");

    assert.ok(root && level1 && level2 && room);
    assert.equal(root.type, "dungeon");
    assert.equal(level1.type, "dungeon_level");
    assert.equal(room.type, "room");

    // Die Gliederungsklammer „TEIL C" steht nicht zwischen Dungeon und Ebene —
    // sonst fände das Dungeon-Cockpit die Ebenen nicht.
    assert.equal(level1.parentPageId, root.id);
    assert.equal(level2.parentPageId, root.id);
    assert.equal(room.parentPageId, level1.id);

    assert.equal(level1.sortIndex, 0);
    assert.equal(level2.sortIndex, 1);
    assert.equal(root.sortIndex, null);
  });

  it("gives a colliding slug a suffix instead of failing", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Kollision", slug: "kollision" });
    await repo.createPage({ worldId: world.id, title: "Ferlor", slug: "ferlor", type: "location" });

    const plan = buildDocImportPlan([{ fileName: "f.md", content: "# Ferlor\n\nEin Dorf." }], {
      mode: "wiki_pages",
      profile: "plain",
    });

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "kollision",
      confirmed: true,
    });

    assert.equal(result.created, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.pages[0].slug, "ferlor-2");
  });

  it("only writes the selected drafts and says so when a parent was left out", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Auswahl", slug: "auswahl" });

    const plan = buildDocImportPlan([{ fileName: "turm.md", content: TURM }], {
      mode: "document",
      profile: "dungeon",
    });

    const room = plan.pages.find((page) => page.title === "Der Ring");
    assert.ok(room);

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "auswahl",
      confirmed: true,
      keys: [room.key],
    });

    assert.equal(result.created, 1);
    assert.ok(result.warnings.some((warning) => warning.includes("übergeordnete Seite")));

    const written = await repo.getPageBySlug("auswahl", room.slug);
    assert.equal(written?.parentPageId, null);
  });

  it("übernimmt eine von Hand korrigierte Typ-Zuordnung", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Korrektur", slug: "korrektur" });

    const plan = buildDocImportPlan([{ fileName: "turm.md", content: TURM }], {
      mode: "document",
      profile: "dungeon",
    });

    const ring = plan.pages.find((page) => page.title === "Der Ring");
    assert.ok(ring);
    assert.equal(ring.type, "room");

    await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "korrektur",
      confirmed: true,
      typeOverrides: { [ring.key]: "npc" },
    });

    const written = await repo.getPageBySlug("korrektur", "der-ring");
    assert.equal(written?.type, "npc");
  });

  it("refuses to write without confirmation", async () => {
    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Ohne", slug: "ohne-bestaetigung" });

    await assert.rejects(
      () =>
        writeDocImport(repo, [], [], { worldSlug: "ohne-bestaetigung", confirmed: false }),
      /confirmed/,
    );
  });
});
