import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractDefinitionBullets,
  extractLabelledBlocks,
  looksLikeCombatStatblock,
  splitStatblockBody,
  wrapDmSection,
} from "./blocks";

const WERTEBLOECKE = [
  "*Alle Blöcke sind eigenständige Kreationen im 5e-Format.*",
  "",
  "**F.2 Bannläufer** (3 in C.1.3) — *Mittelgroßer Konstrukt*",
  "**RK** 17 · **TP** 68 · **Tempo** 9 m",
  "**Multiattacke:** 2× Amtsgriff +7",
  "",
  "**F.3 Wortmotten** (Schwarm) — *Schwarm winziger Bestien*",
  "**RK** 13 · **TP** 44",
].join("\n");

describe("extractLabelledBlocks", () => {
  const result = extractLabelledBlocks(WERTEBLOECKE);

  it("löst jeden nummerierten Block heraus", () => {
    assert.deepEqual(
      result.blocks.map((block) => [block.label, block.title]),
      [
        ["F.2", "Bannläufer"],
        ["F.3", "Wortmotten"],
      ],
    );
  });

  it("lässt die Einleitung stehen", () => {
    assert.equal(result.lead, "*Alle Blöcke sind eigenständige Kreationen im 5e-Format.*");
  });

  it("bricht nicht an fetten Werte-Zeilen ohne Nummer", () => {
    // `**RK** 17` beginnt genauso mit Fettschrift wie `**F.2 Bannläufer**` —
    // ohne die Nummernpflicht zerfiele jeder Werteblock in seine Zeilen.
    assert.ok(result.blocks[0].body.includes("**RK** 17"));
    assert.ok(result.blocks[0].body.includes("Multiattacke"));
  });

  it("findet nichts in gewöhnlichem Fließtext", () => {
    const plain = extractLabelledBlocks("**Wichtig:** Das Buch ist sauber.\n\n**Leitmotiv:** Bürokratie.");
    assert.equal(plain.blocks.length, 0);
  });
});

describe("extractDefinitionBullets", () => {
  const result = extractDefinitionBullets(
    [
      "Vier Nischen mit Statuen.",
      "- **Der Ring:** Das Foyer läuft als Kreisgang um den Hohlkern.",
      "  Vier Nischen, in allen sitzt Sporenleuchten.",
      "- **Die Wachstube (Ost):** Waffenständer, ein kaltes Kohlebecken.",
    ].join("\n"),
  );

  it("macht aus jedem Stichwort einen Eintrag", () => {
    assert.deepEqual(
      result.blocks.map((block) => block.title),
      ["Der Ring", "Die Wachstube (Ost)"],
    );
  });

  it("nimmt Fortsetzungszeilen mit", () => {
    assert.ok(result.blocks[0].body.includes("Sporenleuchten"));
  });

  it("lässt den Vorspann bei der Ebene", () => {
    assert.equal(result.lead, "Vier Nischen mit Statuen.");
  });
});

describe("looksLikeCombatStatblock", () => {
  it("erkennt 5e-Werte", () => {
    assert.equal(looksLikeCombatStatblock("**RK** 17 · **TP** 68"), true);
    assert.equal(looksLikeCombatStatblock("Standardwerte: Rattenschwarm, KON-Rettung SG 11"), true);
  });

  it("glaubt der Ansage des Autors mehr als den Werten", () => {
    assert.equal(
      looksLikeCombatStatblock("Kein Kampf. Er kämpft nie. **RK** 15, **TP** 40."),
      false,
    );
    assert.equal(looksLikeCombatStatblock("— kein Kampfblock. Ein Mensch im Tiefschlaf."), false);
  });
});

describe("splitStatblockBody", () => {
  it("trennt an der ersten Wertezeile", () => {
    const { description, values } = splitStatblockBody(
      ["*Mittelgroßer Konstrukt, ordnungsgemäß*", "**RK** 17 · **TP** 68", "**Multiattacke:** 2×"].join("\n"),
    );
    assert.equal(description, "*Mittelgroßer Konstrukt, ordnungsgemäß*");
    assert.ok(values.startsWith("**RK** 17"));
    assert.ok(values.includes("Multiattacke"));
  });

  it("prüft nur den Zeilenanfang", () => {
    // „TP 9" mitten im Satz ist Beschreibung, kein Werteblock.
    const { description, values } = splitStatblockBody(
      "— kein Kampfblock. Ein 130-jähriger Mensch im Tiefschlaf, TP 9, hilflos.",
    );
    assert.ok(description.includes("Tiefschlaf"));
    assert.equal(values, "");
  });

  it("lässt alles Beschreibung, wenn keine Werte dastehen", () => {
    const { description, values } = splitStatblockBody("Er kämpft nie. Er erscheint und geht.");
    assert.equal(values, "");
    assert.equal(description, "Er kämpft nie. Er erscheint und geht.");
  });
});

describe("wrapDmSection", () => {
  it("legt den Text in eine :::dm-Marke", () => {
    assert.equal(
      wrapDmSection("Werteblock", "**RK** 17"),
      ":::dm Werteblock\n\n**RK** 17\n\n:::",
    );
  });
});
