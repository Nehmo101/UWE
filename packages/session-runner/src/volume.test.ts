import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildVolume, buildVolumeToc, countVolumePages, findVolumeRoots } from "./volume";
import type { ReadingPage } from "./reading-order";

const PAGES: ReadingPage[] = [
  { id: "root", parentPageId: null, sortIndex: null, title: "Der Turm", slug: "turm", type: "dungeon" },
  { id: "e1", parentPageId: "root", sortIndex: 0, title: "Ebene 1", slug: "ebene-1", type: "dungeon_level" },
  { id: "r1", parentPageId: "e1", sortIndex: 0, title: "Der Ring", slug: "der-ring", type: "room" },
  { id: "e2", parentPageId: "root", sortIndex: 1, title: "Ebene 2", slug: "ebene-2", type: "dungeon_level" },
  { id: "src", parentPageId: "root", sortIndex: 2, title: "Quelltext", slug: "quelltext", type: "note" },
  { id: "solo", parentPageId: null, sortIndex: null, title: "Xarza", slug: "xarza", type: "npc" },
];

const HTML = new Map([
  ["root", "<p>Ein Turm.</p>"],
  ["e1", "<p>Ein Foyer.</p>"],
  ["r1", "<p>Ein Kreisgang.</p>"],
  ["src", "<pre>roh</pre>"],
]);

describe("buildVolume", () => {
  it("legt den Band in Lesereihenfolge an", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML });
    assert.deepEqual(
      volume?.sections.map((section) => [section.title, section.depth]),
      [
        ["Der Turm", 0],
        ["Ebene 1", 1],
        ["Der Ring", 2],
        ["Ebene 2", 1],
        ["Quelltext", 1],
      ],
    );
  });

  it("erkennt Abschnitte ohne eigenen Text", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML });
    assert.equal(volume?.filled, 4);
    assert.equal(volume?.sections.find((section) => section.title === "Ebene 2")?.empty, true);
  });

  it("lässt ausgeschlossene Seiten samt Unterseiten weg", () => {
    const volume = buildVolume(PAGES, "root", {
      htmlById: HTML,
      exclude: (page) => page.type === "note",
    });
    assert.ok(!volume?.sections.some((section) => section.title === "Quelltext"));
  });

  it("gibt null zurück, wenn es die Wurzel nicht gibt", () => {
    assert.equal(buildVolume(PAGES, "weg", { htmlById: HTML }), null);
  });

  it("baut Sprungmarken aus dem Slug", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML });
    assert.equal(volume?.sections[1].anchor, "abschnitt-ebene-1");
  });
});

describe("buildVolumeToc", () => {
  it("lässt die Wurzel weg und begrenzt die Tiefe", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML })!;
    assert.deepEqual(
      buildVolumeToc(volume, 1).map((entry) => entry.title),
      ["Ebene 1", "Ebene 2", "Quelltext"],
    );
  });
});

describe("findVolumeRoots", () => {
  it("findet Seiten mit Unterseiten, aber ohne Elternteil", () => {
    assert.deepEqual(
      findVolumeRoots(PAGES).map((page) => page.title),
      ["Der Turm"],
    );
  });

  it("zählt den Umfang eines Bandes", () => {
    assert.equal(countVolumePages(PAGES, "root"), 5);
  });
});
