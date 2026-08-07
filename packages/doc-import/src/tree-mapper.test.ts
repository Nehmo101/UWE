import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDocument } from "./dialect";
import { buildDocumentTree } from "./doc-tree";
import { campaignTag, mapDocumentTree } from "./tree-mapper";

function mapSource(
  markdown: string,
  options: Partial<Parameters<typeof mapDocumentTree>[1]> = {},
) {
  const parsed = parseDocument(markdown);
  return mapDocumentTree(buildDocumentTree(parsed.body), {
    profile: "plain",
    frontmatter: parsed.frontmatter,
    fallbackTitle: "Ohne Titel",
    ...options,
  });
}

/** Ausschnitt in der Gestalt von „Der Magister-Turm von Validori". */
const DUNGEON = `# DER MAGISTER-TURM VON VALIDORI

Ein Dungeon für Stufe 8.

# TEIL A — FÜR DIE SPIELLEITUNG

## A.1 Die Wahrheit in fünf Sätzen

Der Turm ist eine Pumpe.

# TEIL C — DER TURM

## C.1 EBENE 1 — Der versiegelte Eingangsring

Ein zeremonielles Foyer.

### C.1.1 Die Räume

Der Ring läuft als Kreisgang.

### C.1.3 Die Bannläufer (Begegnung, vermeidbar)

3 Bannläufer.

# TEIL G — HANDOUTS

Handout 1.
`;

describe("mapDocumentTree — Wurzelfaltung", () => {
  it("makes the first root the document and the rest its children", () => {
    const { pages } = mapSource(DUNGEON, { profile: "dungeon" });

    const root = pages[0];
    assert.equal(root.title, "DER MAGISTER-TURM VON VALIDORI");
    assert.equal(root.parentKey, null);
    assert.equal(root.sortIndex, null);

    const parts = pages.filter((page) => page.parentKey === root.key);
    assert.deepEqual(
      parts.map((page) => [page.title, page.sortIndex]),
      [
        ["TEIL A — FÜR DIE SPIELLEITUNG", 0],
        ["TEIL C — DER TURM", 1],
        ["TEIL G — HANDOUTS", 2],
      ],
    );
  });

  it("keeps the grandchildren under their own part", () => {
    const { pages } = mapSource(DUNGEON, { profile: "dungeon" });
    const byTitle = new Map(pages.map((page) => [page.title, page]));

    const level = byTitle.get("C.1 EBENE 1 — Der versiegelte Eingangsring");
    const part = byTitle.get("TEIL C — DER TURM");
    const rooms = byTitle.get("C.1.1 Die Räume");

    assert.ok(level && part && rooms);
    assert.equal(level.parentKey, part.key);
    assert.equal(rooms.parentKey, level.key);
  });
});

describe("mapDocumentTree — Typprofile", () => {
  it("reads the dungeon shapes off the headings", () => {
    const { pages } = mapSource(DUNGEON, { profile: "dungeon" });
    const types = new Map(pages.map((page) => [page.title, page.type]));

    assert.equal(types.get("DER MAGISTER-TURM VON VALIDORI"), "dungeon");
    assert.equal(types.get("C.1 EBENE 1 — Der versiegelte Eingangsring"), "dungeon_level");
    assert.equal(types.get("C.1.1 Die Räume"), "room");
    assert.equal(types.get("C.1.3 Die Bannläufer (Begegnung, vermeidbar)"), "encounter");
    assert.equal(types.get("TEIL G — HANDOUTS"), "handout");
    assert.equal(types.get("A.1 Die Wahrheit in fünf Sätzen"), "lore");
  });

  it("reads the campaign-book shapes", () => {
    const { pages } = mapSource(
      [
        "# HIMMELSROUTEN",
        "Ein Kampagnenbuch.",
        "## Szene 1: Feuer im Dock",
        "Es brennt.",
        "## KAPITEL 13: NEBENQUESTS",
        "18 Abenteuer.",
        "## 4.1 Die Handelsgilde der Weißen Feder",
        "Das Kartell.",
        "## KAPITEL 16: BESTIARIUM & NSC-WERTEBLÖCKE",
        "Wolkenwal.",
      ].join("\n\n"),
      { profile: "campaign_book" },
    );
    const types = new Map(pages.map((page) => [page.title, page.type]));

    assert.equal(types.get("Szene 1: Feuer im Dock"), "encounter");
    assert.equal(types.get("KAPITEL 13: NEBENQUESTS"), "quest");
    assert.equal(types.get("4.1 Die Handelsgilde der Weißen Feder"), "faction");
    assert.equal(types.get("KAPITEL 16: BESTIARIUM & NSC-WERTEBLÖCKE"), "monster");
    assert.equal(types.get("HIMMELSROUTEN"), "lore");
  });

  it("turns plain chapter/act headings into story_arc pages (Kampagnen-Cockpit)", () => {
    const { pages } = mapSource(
      [
        "# HIMMELSROUTEN",
        "Ein Kampagnenbuch.",
        "## AKT II — Der Sturm zieht auf",
        "Es zieht sich zusammen.",
        "## Kapitel 2: Der Zaunkönig",
        "Windhafen wartet.",
      ].join("\n\n"),
      { profile: "campaign_book" },
    );
    const types = new Map(pages.map((page) => [page.title, page.type]));

    // Kapitel ohne spezifischeres Inhaltsmuster werden Story-Bögen —
    // Inhaltsregeln (Nebenquests, Bestiarium …) gehen weiterhin vor.
    assert.equal(types.get("AKT II — Der Sturm zieht auf"), "story_arc");
    assert.equal(types.get("Kapitel 2: Der Zaunkönig"), "story_arc");
  });

  it("lets an explicit frontmatter type win — but only for the root", () => {
    const { pages } = mapSource("---\ntyp: nsc\n---\n\n# Pellar\n\n## Chronik\n\nText.", {
      profile: "plain",
    });

    assert.equal(pages[0].type, "npc");
    assert.equal(pages[1].type, "lore");
  });

  it("keeps structural document roots out of the campaign chapter list", () => {
    const campaign = mapSource(
      "---\ntyp: kapitel\n---\n\n# Himmelsrouten\n\n## Kapitel 1: Aufbruch\n\nText.",
      { profile: "campaign_book" },
    );
    const dungeon = mapSource(
      "---\ntyp: kapitel\n---\n\n# Der Magisterturm\n\n## Ebene 1\n\nText.",
      { profile: "dungeon" },
    );

    assert.equal(campaign.pages[0].type, "lore");
    assert.equal(campaign.pages[1].type, "story_arc");
    assert.equal(dungeon.pages[0].type, "dungeon");
  });
});

describe("mapDocumentTree — Kanon-Status", () => {
  it("takes the status from the heading marker, then frontmatter, then profile", () => {
    const { pages } = mapSource(
      "---\nstatus: kanon\n---\n\n# TERRA\n\n## 4.3 Vel-Sharaun ◆\n\nT.\n\n## 2.3 Zeitleiste ◇\n\nT.",
      { profile: "canon" },
    );
    const status = new Map(pages.map((page) => [page.title, page.canonicalStatus]));

    assert.equal(status.get("TERRA"), "canon");
    assert.equal(status.get("4.3 Vel-Sharaun"), "canon");
    assert.equal(status.get("2.3 Zeitleiste"), "idea");
  });

  it("defaults a canon document to canon and everything else to draft", () => {
    assert.equal(mapSource("# A", { profile: "canon" }).pages[0].canonicalStatus, "canon");
    assert.equal(mapSource("# A", { profile: "campaign_book" }).pages[0].canonicalStatus, "draft");
  });
});

describe("mapDocumentTree — Slugs", () => {
  it("qualifies a colliding slug with its parent before counting up", () => {
    const { pages } = mapSource(
      ["# Buch", "## Kapitel 1", "### Auf einen Blick", "## Kapitel 2", "### Auf einen Blick"].join(
        "\n\n",
      ),
    );
    const slugs = pages.map((page) => page.slug);

    assert.deepEqual(slugs, [
      "buch",
      "kapitel-1",
      "auf-einen-blick",
      "kapitel-2",
      "kapitel-2-auf-einen-blick",
    ]);
  });

  it("avoids slugs that the world already uses", () => {
    const { pages } = mapSource("# Ferlor", { existingSlugs: ["ferlor"] });
    assert.equal(pages[0].slug, "ferlor-2");
  });

  it("honours an explicit slug from the frontmatter", () => {
    const { pages } = mapSource("---\nslug: pellar\n---\n\n# Pellar Hopsenried");
    assert.equal(pages[0].slug, "pellar");
  });
});

describe("mapDocumentTree — Kampagnen, Tags, Beziehungen", () => {
  it("turns every campaign into a tag and keeps the order", () => {
    const { pages } = mapSource(
      "---\nkampagnen: [Turm, Himmelsrouten]\ntags: [nsc]\n---\n\n# Pellar\n\n## Chronik\n\nT.",
    );

    assert.deepEqual(pages[0].campaigns, ["Turm", "Himmelsrouten"]);
    assert.deepEqual(pages[0].tags, ["nsc", "kampagne/turm", "kampagne/himmelsrouten"]);
    // Auch Unterseiten gehören zur Kampagne, aber erben keine inhaltlichen Tags.
    assert.deepEqual(pages[1].tags, ["kampagne/turm", "kampagne/himmelsrouten"]);
  });

  it("makes siehe_auch a relation draft on the root only", () => {
    const { relations, pages } = mapSource(
      "---\nsiehe_auch: [ferlor, xarza]\n---\n\n# Pellar\n\n## Chronik\n\nT.",
    );

    assert.deepEqual(relations, [
      { sourceKey: pages[0].key, targetLookup: "ferlor", relationType: "related", label: null },
      { sourceKey: pages[0].key, targetLookup: "xarza", relationType: "related", label: null },
    ]);
  });

  it("keeps unknown frontmatter on the root as metadata", () => {
    const { pages } = mapSource("---\nspezies: Harengon\nstand: 37.03.1174\n---\n\n# Pellar");

    assert.deepEqual(pages[0].metadata.frontmatter, {
      spezies: "Harengon",
      stand: "37.03.1174",
    });
    assert.equal(pages[0].metadata.source, "doc-import");
    assert.deepEqual(pages[0].metadata.docPath, ["Pellar"]);
  });
});

describe("mapDocumentTree — Randfälle", () => {
  it("makes one page out of a document without headings", () => {
    const { pages } = mapSource("---\ntitel: Notiz\n---\n\nNur Fließtext.", {
      fallbackTitle: "notiz.md",
    });

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, "Notiz");
    assert.ok(pages[0].html.includes("Nur Fließtext."));
  });

  it("falls back to the file name when nothing else names the document", () => {
    const { pages } = mapSource("Nur Fließtext.", { fallbackTitle: "pellar-hopsenried" });
    assert.equal(pages[0].title, "pellar-hopsenried");
  });

  it("moves the preamble into the root page", () => {
    const { pages } = mapSource("Ein Vorspann.\n\n# Titel\n\nText.");
    assert.ok(pages[0].html.includes("Ein Vorspann."));
    assert.ok(pages[0].html.includes("Text."));
  });

  it("warns when the frontmatter title disagrees with the first heading", () => {
    const { warnings, pages } = mapSource("---\ntitel: Pellar Hopsenried\n---\n\n# Pellar\n\nT.");

    assert.equal(pages[0].title, "Pellar Hopsenried");
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("Pellar Hopsenried"));
  });
});

describe("mapDocumentTree — eine Datei, eine Seite (Bulk-Wiki)", () => {
  it("keeps every section in one page when mergeRoots is body", () => {
    const parsed = parseDocument("# Pellar\n\n## Beschreibung\n\nFell.\n\n## Chronik\n\n| a | b |\n|---|---|\n| 1 | 2 |");
    const { pages } = mapDocumentTree(buildDocumentTree(parsed.body, { maxDepth: 1 }), {
      profile: "plain",
      frontmatter: parsed.frontmatter,
      fallbackTitle: "pellar",
      mergeRoots: "body",
    });

    assert.equal(pages.length, 1);
    assert.ok(pages[0].html.includes("Beschreibung"));
    assert.ok(pages[0].html.includes("Fell."));
    assert.ok(pages[0].html.includes("<table>"));
  });

  it("also folds in further top-level headings", () => {
    const parsed = parseDocument("# Eins\n\nA.\n\n# Zwei\n\nB.");
    const { pages } = mapDocumentTree(buildDocumentTree(parsed.body, { maxDepth: 1 }), {
      profile: "plain",
      frontmatter: parsed.frontmatter,
      fallbackTitle: "x",
      mergeRoots: "body",
    });

    assert.equal(pages.length, 1);
    assert.equal(pages[0].title, "Eins");
    assert.ok(pages[0].html.includes("A."));
    assert.ok(pages[0].html.includes("Zwei"));
    assert.ok(pages[0].html.includes("B."));
  });
});

describe("mapDocumentTree — keine Seiteneffekte", () => {
  it("leaves the input tree untouched so it can be mapped twice", () => {
    const parsed = parseDocument("# A\n\nT.\n\n# B\n\nT.\n\n# C\n\nT.");
    const tree = buildDocumentTree(parsed.body, { maxDepth: 1 });
    const options = {
      profile: "plain" as const,
      frontmatter: parsed.frontmatter,
      fallbackTitle: "x",
    };

    const first = mapDocumentTree(tree, options);
    const second = mapDocumentTree(tree, options);

    assert.equal(first.pages.length, 3);
    assert.equal(second.pages.length, first.pages.length);
    assert.deepEqual(
      second.pages.map((page) => page.title),
      first.pages.map((page) => page.title),
    );
    assert.equal(tree.nodes.length, 3);
  });
});

describe("campaignTag", () => {
  it("builds a namespaced tag in Lasse's own style", () => {
    assert.equal(campaignTag("Turm"), "kampagne/turm");
    assert.equal(campaignTag("Himmelsrouten"), "kampagne/himmelsrouten");
    assert.equal(campaignTag("Über den Wolken"), "kampagne/ueber-den-wolken");
  });
});
