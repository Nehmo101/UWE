import test from "node:test";
import assert from "node:assert/strict";
import { detectPageTypeFromContent } from "./page-type-detect";

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
