import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPortalCharacterView } from "./character-service";
import { buildCharacterSheetMarkdown, buildCharacterSheetPrintHtml } from "./character-sheet-export";

function completeCharacter() {
  return toPortalCharacterView({
    id: "character-1",
    displayName: "Liora <Windfeder>",
    level: 1,
    rulesEdition: "dnd5e_2024",
    abilities: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
    combat: { armorClass: 12, maxHp: 7, currentHp: 6, speed: 30 },
    classes: [{ name: "Zauberer", level: 1, subclass: "Schule der Erkenntnis" }],
    species: { schemaVersion: 1, key: "elf", name: "Elf" },
    background: { schemaVersion: 1, key: "scribe", name: "Schreiber" },
    features: {
      schemaVersion: 1,
      entries: [],
      proficiencies: { armor: [], weapons: [], tools: [] },
      languages: [
        { key: "common", name: "Gemeinsprache" },
        { key: "elvish", name: "Elfisch" },
      ],
    },
    bio: {
      schemaVersion: 1,
      alignment: { key: "neutral-good", name: "Neutral gut" },
      pronouns: "sie/ihr",
      age: "108",
      height: "1,72 m",
      weight: "58 kg",
      eyes: "Grün",
      hair: "Silbern",
      skin: "Hell",
      appearance: "Silbernes Haar.",
      personality: "Neugierig.",
      ideals: "Wissen.",
      bonds: "Die Bibliothek.",
      flaws: "Übermütig.",
      backstory: "Suchte das verschollene Archiv.",
    },
    skills: null,
    spellcasting: null,
    ownerUserId: "player-1",
    pageId: null,
    notes: "Spielernotiz",
    page: null,
    spells: [{
      id: "spell-1",
      spellKey: "magisches-geschoss",
      spellLevel: 1,
      prepared: true,
      source: "character_creator",
      displayName: "Magisches Geschoss",
      school: null,
      description: "",
      notes: "",
    }],
  });
}

describe("character sheet export", () => {
  it("includes the complete structured creator profile in markdown", () => {
    const markdown = buildCharacterSheetMarkdown({
      character: completeCharacter(),
      inventoryItems: [{ name: "Heiltrank", quantity: 2, notes: "Startausrüstung" }],
      worldName: "Terra",
    });
    assert.match(markdown, /Spezies: Elf/);
    assert.match(markdown, /Klasse: Zauberer \(Schule der Erkenntnis\)/);
    assert.match(markdown, /Gesinnung: Neutral gut/);
    assert.match(markdown, /Sprachen: Gemeinsprache, Elfisch/);
    assert.match(markdown, /Pronomen: sie\/ihr/);
    assert.match(markdown, /Magisches Geschoss \(Grad 1, vorbereitet\)/);
    assert.match(markdown, /Hintergrundgeschichte\nSuchte das verschollene Archiv/);
  });

  it("escapes profile data in printable HTML", () => {
    const html = buildCharacterSheetPrintHtml({ character: completeCharacter() }, { includeToolbar: false });
    assert.match(html, /Liora &lt;Windfeder&gt;/);
    assert.match(html, /Herkunft &amp; Ausrüstung/);
    assert.match(html, /Silbernes Haar/);
    assert.doesNotMatch(html, /<h1>Liora <Windfeder><\/h1>/);
  });
});