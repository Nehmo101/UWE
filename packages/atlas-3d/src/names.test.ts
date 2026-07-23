import assert from "node:assert/strict";
import { test } from "node:test";
import { NAME_CULTURES, generateNameSuggestions, generatePlaceName, type NameCultureKey } from "./names";

const CULTURE_KEYS = NAME_CULTURES.map((c) => c.key) as readonly NameCultureKey[];

test("place names are deterministic per (culture, seed, index)", () => {
  for (const culture of CULTURE_KEYS) {
    assert.equal(generatePlaceName(culture, 7, 3), generatePlaceName(culture, 7, 3));
  }
  assert.notEqual(generatePlaceName("nordisch", 7, 3), generatePlaceName("nordisch", 8, 3), "seed changes the name");
  assert.notEqual(generatePlaceName("nordisch", 7, 3), generatePlaceName("nordisch", 7, 4), "index changes the name");
});

test("cultures produce recognisably different names for the same seed", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const names = CULTURE_KEYS.map((culture) => generatePlaceName(culture, seed, 0));
    assert.equal(new Set(names).size, 4, `all 4 cultures differ for seed ${seed} (got ${names.join(", ")})`);
  }
});

test("suggestions are unique and respect count", () => {
  for (const culture of CULTURE_KEYS) {
    const suggestions = generateNameSuggestions(culture, 11, 12);
    assert.equal(suggestions.length, 12);
    assert.equal(new Set(suggestions).size, 12, "no duplicates");
    assert.deepEqual(suggestions, generateNameSuggestions(culture, 11, 12), "deterministic");
  }
});

test("names are capitalised words of length 4..20", () => {
  for (const culture of CULTURE_KEYS) {
    for (let seed = 1; seed <= 5; seed++) {
      for (const name of generateNameSuggestions(culture, seed, 20)) {
        assert.match(name, /^[A-ZÄÖÜ][a-zäöüß'-]+/, `${culture}: ${name}`);
        assert.ok(name.length >= 4 && name.length <= 20, `${culture}: length of ${name} is ${name.length}`);
      }
    }
  }
});
