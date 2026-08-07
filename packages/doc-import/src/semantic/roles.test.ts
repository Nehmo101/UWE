import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifySection, describeStructure, splitHeadingLabel, tidyHeadingText } from "./roles";
import type { DocumentNode } from "../types";

function node(title: string, body = ""): DocumentNode {
  return { level: 2, title, body, marker: null, sortIndex: 0, children: [] };
}

const dungeon = { profile: "dungeon" as const, parentRole: "dungeon" as const, isRoot: false };

describe("splitHeadingLabel", () => {
  it("trennt die Gliederungsnummer ab", () => {
    assert.deepEqual(splitHeadingLabel("C.1.3 Die Bannläufer"), {
      label: "C.1.3",
      text: "Die Bannläufer",
    });
  });

  it("trennt Teil-Etiketten ab", () => {
    assert.deepEqual(splitHeadingLabel("TEIL D — DAS DACH"), { label: "TEIL D", text: "DAS DACH" });
  });

  it("lässt die Überschrift stehen, wenn nichts Brauchbares übrig bliebe", () => {
    assert.deepEqual(splitHeadingLabel("Teil A"), { label: null, text: "Teil A" });
    assert.deepEqual(splitHeadingLabel("1. Ja"), { label: null, text: "1. Ja" });
  });
});

describe("tidyHeadingText", () => {
  it("nimmt Großschreibung zurück und lässt Partikel klein", () => {
    assert.equal(tidyHeadingText("DER MAGISTER-TURM VON VALIDORI"), "Der Magister-Turm von Validori");
    assert.equal(tidyHeadingText("FÜR DIE SPIELLEITUNG"), "Für die Spielleitung");
  });

  it("fasst gemischte Schreibweise nicht an", () => {
    assert.equal(
      tidyHeadingText("EBENE 1 — Der versiegelte Eingangsring"),
      "EBENE 1 — Der versiegelte Eingangsring",
    );
  });

  it("streicht redaktionelle Klammern, aber keine Ortsangaben", () => {
    assert.equal(tidyHeadingText("Die Bannläufer (Begegnung, vermeidbar)"), "Die Bannläufer");
    assert.equal(tidyHeadingText("Die Wachstube (Ost)"), "Die Wachstube (Ost)");
  });
});

describe("classifySection", () => {
  it("erkennt Ebenen nur am Anfang der Überschrift", () => {
    assert.equal(classifySection(node("EBENE 3 — Alchemische Diagnostik"), dungeon), "level");
    // Sonst würde ein Kampfhinweis zwischen den Stockwerken stehen.
    assert.equal(classifySection(node("Startbedingungen (abhängig von Ebene 6)"), dungeon), "detail");
  });

  it("erkennt den Außenbereich als Ebene — auch im Kompositum", () => {
    assert.equal(classifySection(node("DIE WURZELPLATTFORM"), dungeon), "level");
  });

  it("erbt den Gegenstand aus der Liste darüber", () => {
    assert.equal(
      classifySection(node("Nepurga"), { ...dungeon, parentRole: "statblock_list" }),
      "statblock",
    );
    assert.equal(classifySection(node("Der Ring"), { ...dungeon, parentRole: "room_list" }), "room");
  });

  it("erkennt Personen an der Amtsbezeichnung, auch hinter einem Doppelpunkt", () => {
    assert.equal(classifySection(node("Die offene Tür: Magister Orvin Quell"), dungeon), "npc");
  });

  it("macht aus einem Saal im Kampagnenbuch einen Ort, im Dungeon einen Raum", () => {
    assert.equal(classifySection(node("Der große Saal"), dungeon), "room");
    assert.equal(
      classifySection(node("Der große Saal"), {
        profile: "campaign_book",
        parentRole: "part",
        isRoot: false,
      }),
      "location",
    );
  });

  it("unterscheidet spielbare Quests von Katalogen und Anleitungen", () => {
    const campaign = {
      profile: "campaign_book" as const,
      parentRole: "part" as const,
      isRoot: false,
    };
    assert.equal(classifySection(node("Questkatalog I: Kleine Quests"), campaign), "part");
    assert.equal(classifySection(node("Nebenquests von Aernis"), campaign), "part");
    assert.equal(classifySection(node("Kleine Quests führen"), campaign), "detail");
    assert.equal(classifySection(node("Quest Q-K1 — Der letzte Brief"), campaign), "quest");
  });
});

describe("describeStructure", () => {
  it("zählt nur, was am Spieltisch zählt", () => {
    assert.equal(
      describeStructure({ dungeon: 1, part: 4, level: 8, room: 23, npc: 1, section: 40 }),
      "23 Räume · 8 Ebenen · 1 NSC",
    );
  });
});
