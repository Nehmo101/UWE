import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { characterSheetUpdateSchema } from "./common";
import {
  characterProfileUpdateSchema,
  deleteOwnedCharacterSchema,
} from "./character-profile";

describe("character creator mutation schemas", () => {
  it("normalizes one or many language keys", () => {
    const base = { worldSlug: "terra", characterId: "character-1", returnPath: "/character" };
    assert.deepEqual(
      characterProfileUpdateSchema.parse({ ...base, languageKeys: "common" }).languageKeys,
      ["common"],
    );
    assert.deepEqual(
      characterProfileUpdateSchema.parse({ ...base, languageKeys: ["common", "elvish"] }).languageKeys,
      ["common", "elvish"],
    );
  });

  it("requires the explicit delete confirmation", () => {
    assert.equal(deleteOwnedCharacterSchema.safeParse({ worldSlug: "terra", characterId: "c", confirmation: "löschen" }).success, false);
    assert.equal(deleteOwnedCharacterSchema.safeParse({ worldSlug: "terra", characterId: "c", confirmation: "CHARAKTER LOESCHEN" }).success, true);
  });

  it("caps levels at 20 and accepts persisted combat values", () => {
    const base = { worldSlug: "terra", characterId: "character-1" };
    assert.equal(characterSheetUpdateSchema.safeParse({ ...base, level: 21 }).success, false);
    assert.equal(characterSheetUpdateSchema.safeParse({ ...base, level: 20, maxHp: 42, currentHp: 17, speed: 30 }).success, true);
  });
});