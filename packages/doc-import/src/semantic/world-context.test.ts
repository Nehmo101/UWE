import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDocumentTree } from "../doc-tree";
import { restructureDocument } from "./restructure";
import {
  buildKnownEntityIndex,
  matchKnownEntity,
  selectMentionedEntities,
  type KnownEntity,
} from "./world-context";

const WELT: KnownEntity[] = [
  { title: "Windhafen", type: "location", aliases: ["Die Boomstadt"] },
  { title: "Xarza", type: "npc" },
  { title: "Tibbik Moosfunke", type: "npc" },
  { title: "Die Handelsgilde", type: "faction" },
  { title: "Kapitel 3", type: "lore" },
  { title: "Ost", type: "location" },
];

describe("buildKnownEntityIndex", () => {
  const index = buildKnownEntityIndex(WELT);

  it("kennt Gegenstände unter Titel und Alias", () => {
    assert.equal(matchKnownEntity("Windhafen", index)?.role, "location");
    assert.equal(matchKnownEntity("Die Boomstadt", index)?.role, "location");
  });

  it("nimmt keine Allerweltsseiten auf", () => {
    // Dass es eine Seite „Kapitel 3" gibt, sagt über eine gleichnamige
    // Überschrift nichts.
    assert.equal(matchKnownEntity("Kapitel 3", index), null);
  });

  it("lässt zu kurze Namen weg", () => {
    // „Ost" träfe „Die Wachstube (Ost)" und jede andere Himmelsrichtung.
    assert.equal(matchKnownEntity("Ost", index), null);
  });

  it("bildet Monster wie NSC ab, behält aber ihren Typ", () => {
    const monster = buildKnownEntityIndex([{ title: "Nepurga", type: "monster" }]);
    const match = matchKnownEntity("Nepurga", monster);
    assert.equal(match?.role, "npc");
    assert.equal(match?.entity.type, "monster");
  });
});

describe("selectMentionedEntities", () => {
  const text = "Die Gruppe reist nach Windhafen. Xarza wartet am Kai.";

  it("nimmt nur, was im Dokument vorkommt", () => {
    assert.deepEqual(
      selectMentionedEntities(WELT, text).map((entity) => entity.title),
      ["Windhafen", "Xarza"],
    );
  });

  it("achtet auf Wortgrenzen", () => {
    assert.deepEqual(selectMentionedEntities([{ title: "Hafen", type: "location" }], text), []);
  });
});

describe("Welt-Wissen im Umbau", () => {
  const SOURCE = [
    "# HIMMELSROUTEN",
    "# KAPITEL 1",
    "## 1.1 Tibbik Moosfunke",
    "Er trägt einen zu großen Hut und riecht nach kaltem Weihrauch.",
    "## 1.2 Windhafen",
    "Vier Viertel, ein Hafen, keine Ordnung.",
  ].join("\n\n");

  function build(known?: KnownEntity[]) {
    return restructureDocument(buildDocumentTree(SOURCE, { maxDepth: 6 }), {
      profile: "campaign_book",
      knownEntities: known ? buildKnownEntityIndex(known) : undefined,
    });
  }

  function flatten(nodes: ReturnType<typeof build>["tree"]["nodes"]): string[] {
    return nodes.flatMap((node) => [`${node.title}:${node.role}:${node.typeHint}`, ...flatten(node.children)]);
  }

  it("erkennt ohne Welt-Wissen keinen Namen", () => {
    // Einem Namen sieht man nicht an, was er ist — deshalb bleibt es Fließtext.
    const titles = flatten(build().tree.nodes);
    assert.ok(!titles.some((entry) => entry.startsWith("Tibbik Moosfunke:npc")));
  });

  it("übernimmt Rolle und Typ aus der Welt", () => {
    const titles = flatten(build(WELT).tree.nodes);
    assert.ok(titles.includes("Tibbik Moosfunke:npc:npc"));
    assert.ok(titles.includes("Windhafen:location:location"));
  });

  it("lässt eine Kapitelüberschrift Kapitel bleiben", () => {
    // „KAPITEL 2 — WINDHAFEN" ist ein Kapitel über Windhafen, nicht die Stadt.
    // Als Ort eingeordnet verlöre es seine Klammer und löste sich auf.
    const { tree } = restructureDocument(
      buildDocumentTree(
        ["# Band", "# KAPITEL 2 — WINDHAFEN", "## 2.1 Die Handelsgilde", "Sie kontrolliert die Kais.", "## 2.2 Szene 3: Die Auktion", "Alles wird versteigert."].join("\n\n"),
        { maxDepth: 6 },
      ),
      { profile: "campaign_book", knownEntities: buildKnownEntityIndex(WELT) },
    );

    const kapitel = tree.nodes[0].children[0];
    assert.equal(kapitel.title, "Windhafen");
    assert.equal(kapitel.role, "part");
    assert.equal(kapitel.children.length, 2);
  });

  it("lässt die Stellung im Dokument schwerer wiegen als den Namensfund", () => {
    // Unter „Werteblöcke" ist ein Eintrag ein Werteblock, auch wenn es die
    // Person in der Welt schon gibt.
    const { tree } = restructureDocument(
      buildDocumentTree(
        ["# Band", "# WERTEBLÖCKE", "**F.1 Tibbik Moosfunke** — *Feenwesen*", "**F.2 Xarza** — *Mensch*"].join("\n\n"),
        { maxDepth: 6 },
      ),
      { profile: "campaign_book", knownEntities: buildKnownEntityIndex(WELT) },
    );

    const anhang = tree.nodes[0].children.find((child) => child.role === "statblock_list");
    assert.deepEqual(
      anhang?.children.map((child) => child.role),
      ["statblock", "statblock"],
    );
  });
});
