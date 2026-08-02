import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOutlinePrompt, parseOutlineHints } from "./ai-hints";
import { buildDocumentTree } from "../doc-tree";
import { restructureDocument } from "./restructure";
import type { OutlineEntry } from "./outline";

const ENTRIES: OutlineEntry[] = [
  { path: "Band", title: "Band", excerpt: "Ein Turm.", role: "dungeon" },
  { path: "Band › Tibbik Moosfunke", title: "Tibbik Moosfunke", excerpt: "Trägt einen zu großen Hut.", role: "section" },
  { path: "Band › Windhafen", title: "Windhafen", excerpt: "Vier Viertel, ein Hafen.", role: "section" },
];

describe("buildOutlinePrompt", () => {
  const prompt = buildOutlinePrompt(ENTRIES, {
    profileLabel: "Dungeon",
    documentTitle: "Der Turm",
  });

  it("nummeriert die Abschnitte, damit die Antwort zuzuordnen ist", () => {
    assert.match(prompt, /2\. \[section\] Band › Tibbik Moosfunke — Trägt einen zu großen Hut\./);
  });

  it("nennt die vorhandene Rolle, damit die KI nur widersprechen muss", () => {
    assert.match(prompt, /\[dungeon\] Band/);
  });

  it("verlangt reines JSON", () => {
    assert.match(prompt, /Antworte NUR als JSON-Array/);
  });
});

describe("parseOutlineHints", () => {
  it("löst Nummern gegen die mitgegebene Liste auf", () => {
    const hints = parseOutlineHints('[{"nr":2,"rolle":"npc"},{"nr":3,"rolle":"location"}]', ENTRIES);
    assert.deepEqual(
      [...hints],
      [
        ["Band › Tibbik Moosfunke", "npc"],
        ["Band › Windhafen", "location"],
      ],
    );
  });

  it("verträgt Geschwätz vor und nach dem JSON", () => {
    const hints = parseOutlineHints('Gerne! [{"nr":2,"rolle":"npc"}] Passt das so?', ENTRIES);
    assert.equal(hints.get("Band › Tibbik Moosfunke"), "npc");
  });

  it("wirft weg, was auf keinen Abschnitt zeigt", () => {
    // Ein Modell kann diesem Import keine Gliederung hinzufügen.
    assert.equal(parseOutlineHints('[{"nr":99,"rolle":"npc"}]', ENTRIES).size, 0);
  });

  it("wirft weg, was keine erlaubte Rolle ist", () => {
    // `dungeon` und `part` bleiben den Regeln — sonst könnte die KI die
    // Dungeon-Invariante aushebeln.
    assert.equal(parseOutlineHints('[{"nr":2,"rolle":"dungeon"}]', ENTRIES).size, 0);
    assert.equal(parseOutlineHints('[{"nr":2,"rolle":"unfug"}]', ENTRIES).size, 0);
  });

  it("bleibt bei kaputter Antwort still", () => {
    assert.equal(parseOutlineHints("kein JSON hier", ENTRIES).size, 0);
    assert.equal(parseOutlineHints("[{kaputt}]", ENTRIES).size, 0);
  });
});

describe("Gliederung und Hinweise passen zusammen", () => {
  /**
   * Der eigentliche Vertrag: Die Pfade, die der erste Durchlauf ausgibt, müssen
   * im zweiten wiedergefunden werden. Stimmt das nicht, liefe der KI-Feinschliff
   * still ins Leere — er würde niemals scheitern und niemals wirken.
   */
  const SOURCE = [
    "# DER TURM",
    "# TEIL A — HINTERGRUND",
    "## A.1 Tibbik Moosfunke",
    "Trägt einen zu großen Hut.",
  ].join("\n\n");

  it("findet den Abschnitt im zweiten Durchlauf wieder", () => {
    const first = restructureDocument(buildDocumentTree(SOURCE, { maxDepth: 6 }), {
      profile: "dungeon",
    });

    const entry = first.outline.find((item) => item.title === "Tibbik Moosfunke");
    assert.ok(entry);

    const answer = JSON.stringify([
      { nr: first.outline.indexOf(entry) + 1, rolle: "npc" },
    ]);
    const hints = parseOutlineHints(answer, first.outline);

    const second = restructureDocument(buildDocumentTree(SOURCE, { maxDepth: 6 }), {
      profile: "dungeon",
      roleHints: hints,
    });

    const walk = (nodes: typeof second.tree.nodes): string[] =>
      nodes.flatMap((node) => [`${node.title}:${node.role}`, ...walk(node.children)]);

    assert.ok(walk(second.tree.nodes).includes("Tibbik Moosfunke:npc"));
  });
});
