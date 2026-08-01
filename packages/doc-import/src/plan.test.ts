import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDocImportPlan } from "./plan";
import { buildDocImportPreview } from "./preview";

const PELLAR = `---
titel: Pellar Hopsenried
typ: nsc
status: kanon
kampagnen: [Turm, Himmelsrouten]
siehe_auch: [ferlor, xarza]
---

# Pellar Hopsenried

## Beschreibung

Hellbraunes Fell.

## Chronik

| Wann | Was |
|---|---|
| ~1154 | Kommt nach [[ferlor]] |
`;

const XARZA = `---
titel: Xarza die Nagelkräuslerin
typ: nsc
---

# Xarza

## Beschreibung

Sie wartete vierzig Jahre.
`;

describe("buildDocImportPlan — Bulk-Wiki", () => {
  const plan = buildDocImportPlan(
    [
      { fileName: "pellar.md", content: PELLAR },
      { fileName: "xarza.md", content: XARZA },
    ],
    { mode: "wiki_pages", profile: "plain" },
  );

  it("makes exactly one page per file", () => {
    assert.equal(plan.pages.length, 2);
    assert.deepEqual(plan.perFile, [
      { fileName: "pellar.md", pageCount: 1 },
      { fileName: "xarza.md", pageCount: 1 },
    ]);
  });

  it("keeps the whole file in that one page", () => {
    const pellar = plan.pages[0];
    assert.ok(pellar.html.includes("Hellbraunes Fell."));
    assert.ok(pellar.html.includes("<table>"));
    assert.ok(pellar.html.includes("[[ferlor]]"));
  });

  it("applies the dialect", () => {
    assert.equal(plan.pages[0].type, "npc");
    assert.equal(plan.pages[0].canonicalStatus, "canon");
    assert.deepEqual(plan.pages[0].tags, ["kampagne/turm", "kampagne/himmelsrouten"]);
  });

  it("turns siehe_auch into relations", () => {
    assert.deepEqual(
      plan.relations.map((relation) => relation.targetLookup),
      ["ferlor", "xarza"],
    );
  });

  it("keeps draft keys unique across files", () => {
    const keys = new Set(plan.pages.map((page) => page.key));
    assert.equal(keys.size, plan.pages.length);
  });
});

describe("buildDocImportPlan — Slugs über Dateien hinweg", () => {
  it("does not hand the same slug to two files", () => {
    const plan = buildDocImportPlan(
      [
        { fileName: "a.md", content: "# Der Wegkrug\n\nEin Gasthaus." },
        { fileName: "b.md", content: "# Der Wegkrug\n\nEin anderes Gasthaus." },
      ],
      { mode: "wiki_pages", profile: "plain" },
    );

    assert.deepEqual(
      plan.pages.map((page) => page.slug),
      ["der-wegkrug", "der-wegkrug-2"],
    );
  });

  it("avoids slugs the world already holds", () => {
    const plan = buildDocImportPlan([{ fileName: "a.md", content: "# Ferlor\n\nEin Dorf." }], {
      mode: "wiki_pages",
      profile: "plain",
      existingSlugs: ["ferlor"],
    });

    assert.equal(plan.pages[0].slug, "ferlor-2");
  });
});

describe("buildDocImportPlan — Dokument", () => {
  const plan = buildDocImportPlan(
    [
      {
        fileName: "turm.md",
        content: [
          "# DER MAGISTER-TURM",
          "Ein Dungeon.",
          "## C.1 EBENE 1 — Eingangsring",
          "Ein Foyer.",
          "### C.1.1 Die Räume",
          "Ein Kreisgang.",
        ].join("\n\n"),
      },
    ],
    { mode: "document", profile: "dungeon", maxDepth: 3 },
  );

  it("builds a tree instead of one page", () => {
    assert.equal(plan.pages.length, 3);
    assert.deepEqual(
      plan.pages.map((page) => [page.type, page.sortIndex]),
      [
        ["dungeon", null],
        ["dungeon_level", 0],
        ["room", 0],
      ],
    );
  });

  it("wires parents to children", () => {
    const [root, level, room] = plan.pages;
    assert.equal(root.parentKey, null);
    assert.equal(level.parentKey, root.key);
    assert.equal(room.parentKey, level.key);
  });
});

describe("buildDocImportPreview", () => {
  const plan = buildDocImportPlan([{ fileName: "pellar.md", content: PELLAR }], {
    mode: "wiki_pages",
    profile: "plain",
  });

  it("flags a slug clash as conflict and a title clash as duplicate", () => {
    const preview = buildDocImportPreview(plan.pages, plan.relations, {
      existingPages: [{ id: "p1", title: "Pellar Hopsenried", slug: "pellar-hopsenried" }],
    });

    assert.equal(preview.items[0].status, "conflict");
    assert.equal(preview.items[0].existingPageId, "p1");
    assert.equal(preview.summary.conflict, 1);
  });

  it("counts a fresh page as new", () => {
    const preview = buildDocImportPreview(plan.pages, plan.relations, { existingPages: [] });

    assert.equal(preview.items[0].status, "new");
    assert.equal(preview.canExecute, true);
  });

  it("names campaigns the world does not have", () => {
    const preview = buildDocImportPreview(plan.pages, plan.relations, {
      existingPages: [],
      campaignNames: ["Turm"],
    });

    assert.deepEqual(preview.unknownCampaigns, ["Himmelsrouten"]);
    assert.ok(preview.warnings.some((warning) => warning.includes("Himmelsrouten")));
  });

  it("reports siehe_auch targets that will still be missing", () => {
    const preview = buildDocImportPreview(plan.pages, plan.relations, { existingPages: [] });

    assert.ok(preview.warnings.some((warning) => warning.includes("siehe_auch")));
    assert.ok(preview.warnings.some((warning) => warning.includes("ferlor")));
  });

  it("does not call a link broken when the import itself creates the target", () => {
    const both = buildDocImportPlan(
      [
        { fileName: "pellar.md", content: PELLAR },
        { fileName: "ferlor.md", content: "---\ntitel: ferlor\n---\n\n# ferlor\n\nEin Dorf." },
      ],
      { mode: "wiki_pages", profile: "plain" },
    );

    const preview = buildDocImportPreview(both.pages, both.relations, { existingPages: [] });
    assert.ok(!preview.unresolvedLinks.includes("ferlor"));
  });
});
