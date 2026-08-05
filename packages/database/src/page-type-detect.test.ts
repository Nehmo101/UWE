import test from "node:test";
import assert from "node:assert/strict";
import { detectPageType, detectPageTypeFromContent } from "./page-type-detect";

test("detects an inline 'Kategorie: NPC' marker", () => {
  const content =
    "Thalindor Golsa Kategorie: NPC Einst ein Händler mit schimmerndem Lächeln.";
  assert.equal(detectPageTypeFromContent(content), "npc");
});

test("detects German type labels", () => {
  assert.equal(detectPageTypeFromContent("Typ: Ort\n\nEine alte Festung."), "location");
  assert.equal(detectPageTypeFromContent("Kategorie: Fraktion"), "faction");
  assert.equal(detectPageTypeFromContent("Kategorie: Session"), "session");
  assert.equal(detectPageTypeFromContent("Typ: Quest"), "quest");
  assert.equal(detectPageTypeFromContent("Kategorie: Spielercharakter"), "player_character");
  assert.equal(detectPageTypeFromContent("Typ: Dungeon-Ebene"), "dungeon_level");
});

test("supports English markers and synonyms", () => {
  assert.equal(detectPageTypeFromContent("Category: Faction"), "faction");
  assert.equal(detectPageTypeFromContent("Type: Monster"), "monster");
});

test("maps chapter labels to story_arc (Kampagnen-Modul)", () => {
  assert.equal(detectPageTypeFromContent("Typ: Kapitel"), "story_arc");
  assert.equal(detectPageTypeFromContent("Kategorie: Akt"), "story_arc");
  assert.equal(detectPageTypeFromContent("Typ: Story-Bogen"), "story_arc");
});

test("takes the first word when the marker value runs into prose", () => {
  assert.equal(
    detectPageTypeFromContent("Kategorie: Ort — eine verfallene Ruine im Norden"),
    "location",
  );
});

test("does not match 'typ' inside another word (Prototyp:)", () => {
  assert.equal(detectPageTypeFromContent("Prototyp: irgendetwas"), null);
});

test("returns null when no marker or unknown type", () => {
  assert.equal(detectPageTypeFromContent("Ein Text ganz ohne Typ-Marker."), null);
  assert.equal(detectPageTypeFromContent("Kategorie: Blahfasel"), null);
  assert.equal(detectPageTypeFromContent(""), null);
});

test("is case-insensitive", () => {
  assert.equal(detectPageTypeFromContent("KATEGORIE: npc"), "npc");
});

test("strips markdown emphasis around marker and value", () => {
  assert.equal(detectPageTypeFromContent("**Kategorie:** NPC"), "npc");
  assert.equal(detectPageTypeFromContent("Ein Text. *Typ*: _Ort_ im Norden."), "location");
});

test("accepts '=' as a separator", () => {
  assert.equal(detectPageTypeFromContent("Typ = Fraktion"), "faction");
});

test("matches multi-word labels with space or hyphen interchangeably", () => {
  assert.equal(detectPageTypeFromContent("Typ: Dungeon Ebene"), "dungeon_level");
  assert.equal(detectPageTypeFromContent("Typ: Dungeon-Ebene"), "dungeon_level");
});

test("recognizes markers wrapped in parentheses or a blockquote", () => {
  assert.equal(detectPageTypeFromContent("Die Ruine (Kategorie: Ort) im Wald."), "location");
  assert.equal(detectPageTypeFromContent("> Typ: Monster\nGefährlich."), "monster");
});

test("detectPageType prefers a title marker over content", () => {
  assert.equal(
    detectPageType({ title: "Kategorie: NPC — Thalindor", content: "Kategorie: Ort" }),
    "npc",
  );
});

test("detectPageType falls back to an exact tag match", () => {
  assert.equal(detectPageType({ content: "Ein Text ganz ohne Marker.", tags: ["npc"] }), "npc");
  assert.equal(
    detectPageType({ content: "Ein Text.", tags: ["kf-import:eingang-208"] }),
    null,
  );
});
