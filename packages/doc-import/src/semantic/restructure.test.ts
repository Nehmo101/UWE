import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDocumentTree } from "../doc-tree";
import { linkEntityNames } from "./crosslink";
import { collectEntityNodes, restructureDocument, shiftHeadings } from "./restructure";
import type { DocumentNode } from "../types";

const DUNGEON = [
  "# DER MAGISTER-TURM VON VALIDORI",
  "### Ein Dungeon für Stufe 8",
  "## INHALT",
  "Teil A, Teil B, Teil C.",
  "# TEIL A — FÜR DIE SPIELLEITUNG",
  "## A.1 Die Wahrheit",
  "Der Turm ist eine Pumpe.",
  "## A.7 Inquisitor Ruin",
  "Behandle ihn wie ein Naturereignis.",
  "# TEIL C — DER TURM",
  "## C.1 EBENE 1 — Der versiegelte Eingangsring",
  "Ein zeremonielles Foyer.",
  "### C.1.1 Die Räume",
  "- **Der Ring:** Das Foyer läuft als Kreisgang.",
  "- **Die Wachstube (Ost):** Waffenständer und ein kaltes Kohlebecken.",
  "### C.1.3 Die Bannläufer (Begegnung, vermeidbar)",
  "Drei Steinfiguren in Magistertracht.",
  "### C.1.4 Was man hier lernt",
  "Die Lieferungen kommen alle zwei Wochen.",
  "# TEIL D — DAS DACH",
  "Nepurga wartet.",
  "# TEIL F — WERTEBLÖCKE",
  "**F.2 Bannläufer** — *Konstrukt*",
  "**RK** 17 · **TP** 68",
  "**F.10 Nepurga** — *Feenwesen*",
  "**RK** 17 · **TP** 240",
].join("\n\n");

function build(markdown: string, profile: "dungeon" | "campaign_book" = "dungeon") {
  return restructureDocument(buildDocumentTree(markdown, { maxDepth: 6 }), { profile });
}

function flatten(nodes: DocumentNode[], depth = 0): Array<[string, string, number]> {
  return nodes.flatMap((node) => [
    [node.title, node.role ?? "?", depth] as [string, string, number],
    ...flatten(node.children, depth + 1),
  ]);
}

describe("restructureDocument", () => {
  const { tree, stats } = build(DUNGEON);
  const root = tree.nodes[0];
  const titles = flatten(tree.nodes);

  it("hängt jede Ebene direkt unter den Dungeon", () => {
    // Genau hier lag der Fehler: `TEIL C` stand zwischen Dungeon und Ebene,
    // und das Cockpit liest nur direkte Kinder.
    const levels = root.children.filter((child) => child.role === "level");
    assert.deepEqual(
      levels.map((level) => level.title),
      ["EBENE 1 — Der versiegelte Eingangsring", "Das Dach"],
    );
  });

  it("löst reine Gliederungsklammern auf", () => {
    assert.ok(!titles.some(([title]) => title === "Der Turm"));
  });

  it("macht aus Aufzählungen Räume unter der Ebene", () => {
    const level = root.children.find((child) => child.role === "level");
    assert.deepEqual(
      level?.children.filter((child) => child.role === "room").map((child) => child.title),
      ["Der Ring", "Die Wachstube (Ost)"],
    );
  });

  it("faltet Beiwerk in die Seite darüber, statt eine Seite daraus zu machen", () => {
    assert.ok(!titles.some(([title]) => title === "Was man hier lernt"));
    const level = root.children.find((child) => child.role === "level");
    assert.ok(level?.body.includes("Die Lieferungen kommen alle zwei Wochen."));
    assert.ok(stats.folded > 0);
  });

  it("faltet keinen Abschnitt, unter dem noch eine Seite hängt", () => {
    // Der kurze Zwischenabschnitt würde sonst zu Fließtext — und die
    // Inquisitor-Seite darunter verschwände mit ihm im Rumpf.
    const { tree } = build(
      [
        "# Band",
        "# TEIL A — HINTERGRUND",
        "## A.1 Kurz",
        "Zwei Sätze.",
        "### Inquisitor Ruin",
        "Ein Naturereignis.",
      ].join("\n\n"),
    );

    const titles = flatten(tree.nodes).map(([title]) => title);
    assert.ok(titles.includes("Inquisitor Ruin"));
    assert.ok(titles.includes("Kurz"));
  });

  it("löst Werteblöcke aus dem Fließtext", () => {
    const anhang = root.children.find((child) => child.role === "statblock_list");
    assert.deepEqual(
      anhang?.children.map((child) => [child.title, child.typeHint]),
      [
        ["Bannläufer", "monster"],
        ["Nepurga", "monster"],
      ],
    );
    assert.deepEqual(anhang?.children[0].aliases, ["F.2"]);
  });

  it("legt die Regelwerte auf eine Unterseite im DM-Bereich", () => {
    const anhang = root.children.find((child) => child.role === "statblock_list");
    const bannlaeufer = anhang?.children.find((child) => child.title === "Bannläufer");

    // Die Hauptseite trägt, was man über die Kreatur weiß …
    assert.ok(bannlaeufer?.body.includes("Konstrukt"));
    assert.ok(!bannlaeufer?.body.includes("**RK**"));

    // … die Unterseite die Zahlen, und zwar hinter der DM-Marke.
    const werte = bannlaeufer?.children[0];
    assert.equal(werte?.title, "Werteblock: Bannläufer");
    assert.equal(werte?.role, "statblock_values");
    assert.ok(werte?.body.startsWith(":::dm "));
    assert.ok(werte?.body.trimEnd().endsWith(":::"));
    assert.ok(werte?.body.includes("**RK** 17"));
  });

  it("wirft das Inhaltsverzeichnis weg", () => {
    assert.ok(!titles.some(([title]) => title.toLowerCase() === "inhalt"));
  });

  it("schreibt eine Gliederung mit stabilen Pfaden", () => {
    const { outline } = build(DUNGEON);
    assert.ok(outline.some((entry) => entry.path === "DER MAGISTER-TURM VON VALIDORI › DAS DACH"));
  });

  it("folgt einem KI-Hinweis, wenn einer vorliegt", () => {
    const hints = new Map([
      ["DER MAGISTER-TURM VON VALIDORI › FÜR DIE SPIELLEITUNG › Die Wahrheit", "npc" as const],
    ]);
    const hinted = restructureDocument(buildDocumentTree(DUNGEON, { maxDepth: 6 }), {
      profile: "dungeon",
      roleHints: hints,
    });
    assert.ok(
      flatten(hinted.tree.nodes).some(([title, role]) => title === "Die Wahrheit" && role === "npc"),
    );
  });

  it("lässt den Ausgangsbaum unangetastet", () => {
    const raw = buildDocumentTree(DUNGEON, { maxDepth: 6 });
    const before = JSON.stringify(raw);
    restructureDocument(raw, { profile: "dungeon" });
    assert.equal(JSON.stringify(raw), before);
  });
});

const KAMPAGNENBUCH = [
  "# HIMMELSROUTEN",
  "Eine Kampagne für Stufe 3–14.",
  "## Die Welt von Aernis",
  "Wolken, Inseln, Luftschiffe.",
  "### Die Freien Höhen",
  "Ein Landstrich mit eigener Geschichte.",
  "## DER ZAUNKÖNIG (Stufe 3)",
  "Das erste Kapitel.",
  "### Szene 1 — Der Auftrag",
  "Die Gruppe wird angeheuert.",
  "### Szene 2 — Der Überfall",
  "Drei Luftpiraten entern. **RK** 13 · **TP** 22",
  "## Bestiarium",
  "Werteblöcke.",
  "### Luftpirat",
  "**RK** 13 · **TP** 22",
].join("\n\n");

describe("restructureDocument — Kapitel eines Kampagnenbuchs", () => {
  const { tree } = build(KAMPAGNENBUCH, "campaign_book");
  const root = tree.nodes[0];
  const byTitle = (title: string) =>
    root.children.find((child) => child.title.startsWith(title));

  it("macht aus einem Abschnitt mit Szenen einen Story-Bogen", () => {
    // Vorher kam jedes Kapitel als `lore` an und musste im Cockpit von Hand
    // umgestellt werden, bevor die Kampagne überhaupt sichtbar wurde.
    assert.equal(byTitle("DER ZAUNKÖNIG")?.typeHint, "story_arc");
  });

  it("lässt Abschnitte ohne Szenen in Ruhe", () => {
    assert.notEqual(byTitle("Die Welt von Aernis")?.typeHint, "story_arc");
  });

  it("macht aus einer Werteblock-Sammlung keinen Story-Bogen", () => {
    assert.notEqual(byTitle("Bestiarium")?.typeHint, "story_arc");
  });

  it("lässt Dungeon-Ebenen mit Begegnungen unberührt", () => {
    const dungeon = build(DUNGEON).tree.nodes[0];
    const level = dungeon.children.find((child) => child.role === "level");
    assert.equal(level?.typeHint, "dungeon_level");
  });
});

describe("shiftHeadings", () => {
  it("verschiebt Überschriften, aber nicht in Codeblöcken", () => {
    assert.equal(
      shiftHeadings("## Titel\n\n```\n# kein Titel\n```", 1),
      "### Titel\n\n```\n# kein Titel\n```",
    );
  });
});

describe("collectEntityNodes + linkEntityNames", () => {
  it("macht aus Namen im Text Wikilinks", () => {
    const { tree } = build(DUNGEON);
    const targets = collectEntityNodes(tree.nodes).map((node) => ({
      title: node.title,
      aliases: node.aliases ?? [],
    }));

    const linked = linkEntityNames("Auf dem Dach wartet Nepurga. Nepurga ist geduldig.", targets);
    assert.equal(linked, "Auf dem Dach wartet [[Nepurga]]. Nepurga ist geduldig.");
  });

  it("verlinkt nicht in Überschriften, Tabellen und bestehenden Links", () => {
    const targets = [{ title: "Nepurga" }];
    assert.equal(linkEntityNames("# Nepurga", targets), "# Nepurga");
    assert.equal(linkEntityNames("| Nepurga | 240 |", targets), "| Nepurga | 240 |");
    assert.equal(linkEntityNames("[[Nepurga]]", targets), "[[Nepurga]]");
  });

  it("verlinkt eine Seite nicht auf sich selbst", () => {
    assert.equal(linkEntityNames("Nepurga wartet.", [{ title: "Nepurga" }], "Nepurga"), "Nepurga wartet.");
  });
});
