import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CULTURE_PROFILES,
  generatePlaceNames,
  getCultureProfile,
  listCultureProfiles,
} from "./name-culture";
import type { NameKind } from "./name-culture";

const KINDS: readonly NameKind[] = ["settlement", "region", "river", "mountain"];

// ---------------------------------------------------------------------------
// CULTURE_PROFILES / listCultureProfiles / getCultureProfile
// ---------------------------------------------------------------------------

describe("CULTURE_PROFILES", () => {
  it("registers at least 6 profiles", () => {
    assert.ok(CULTURE_PROFILES.length >= 6, "expected >= 6 culture profiles");
  });

  it("has unique keys", () => {
    const keys = CULTURE_PROFILES.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, "profile keys must be unique");
  });

  it("every profile has non-empty endings for every NameKind", () => {
    for (const profile of CULTURE_PROFILES) {
      for (const kind of KINDS) {
        const endings = profile.endings[kind];
        assert.ok(Array.isArray(endings), `${profile.key}.endings.${kind} must be an array`);
        assert.ok(endings.length > 0, `${profile.key}.endings.${kind} must be non-empty`);
      }
    }
  });

  it("every profile has onsets and middles", () => {
    for (const profile of CULTURE_PROFILES) {
      assert.ok(profile.onsets.length > 0, `${profile.key}.onsets must be non-empty`);
      assert.ok(profile.middles.length > 0, `${profile.key}.middles must be non-empty`);
    }
  });
});

describe("listCultureProfiles", () => {
  it("returns a mutable copy (mutating it does not affect CULTURE_PROFILES)", () => {
    const copy = listCultureProfiles();
    const originalLength = CULTURE_PROFILES.length;
    copy.pop();
    assert.equal(CULTURE_PROFILES.length, originalLength);
  });

  it("returns the same profiles as CULTURE_PROFILES", () => {
    const copy = listCultureProfiles();
    assert.deepEqual(
      copy.map((p) => p.key),
      CULTURE_PROFILES.map((p) => p.key),
    );
  });
});

describe("getCultureProfile", () => {
  it("finds a known key", () => {
    const profile = getCultureProfile("nordisch");
    assert.ok(profile);
    assert.equal(profile?.key, "nordisch");
  });

  it("returns undefined for an unknown key", () => {
    assert.equal(getCultureProfile("does-not-exist"), undefined);
  });

  it("returns undefined for null/undefined", () => {
    assert.equal(getCultureProfile(null), undefined);
    assert.equal(getCultureProfile(undefined), undefined);
  });
});

// ---------------------------------------------------------------------------
// generatePlaceNames / determinism
// ---------------------------------------------------------------------------

describe("generatePlaceNames / determinism", () => {
  it("same opts (with explicit seed) → identical list (deep equal)", () => {
    const opts = { culture: "nordisch", kind: "settlement" as NameKind, seed: 42, count: 10 };
    const a = generatePlaceNames(opts);
    const b = generatePlaceNames(opts);
    assert.deepEqual(a, b);
  });

  it("same opts without an explicit seed → identical list (culture+kind derives the seed)", () => {
    const opts = { culture: "elbisch", kind: "river" as NameKind, count: 6 };
    const a = generatePlaceNames(opts);
    const b = generatePlaceNames(opts);
    assert.deepEqual(a, b);
  });

  it("different seeds generally produce different lists", () => {
    const a = generatePlaceNames({ culture: "zwergisch", kind: "region", seed: 1, count: 8 });
    const b = generatePlaceNames({ culture: "zwergisch", kind: "region", seed: 2, count: 8 });
    assert.notDeepEqual(a, b);
  });

  it("different kinds for the same culture/seed generally produce different lists", () => {
    const a = generatePlaceNames({ culture: "imperial", kind: "settlement", seed: 7 });
    const b = generatePlaceNames({ culture: "imperial", kind: "mountain", seed: 7 });
    assert.notDeepEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// generatePlaceNames / uniqueness
// ---------------------------------------------------------------------------

describe("generatePlaceNames / uniqueness", () => {
  it("returns no duplicates within a single batch, across all profiles/kinds", () => {
    for (const profile of CULTURE_PROFILES) {
      for (const kind of KINDS) {
        const names = generatePlaceNames({ culture: profile.key, kind, count: 24, seed: 1234 });
        assert.equal(
          new Set(names).size,
          names.length,
          `${profile.key}/${kind} produced duplicate names: ${JSON.stringify(names)}`,
        );
      }
    }
  });

  it("stays duplicate-free across many different seeds", () => {
    for (let seed = 0; seed < 25; seed++) {
      const names = generatePlaceNames({ culture: "sumpfland", kind: "settlement", count: 20, seed });
      assert.equal(new Set(names).size, names.length, `seed ${seed} produced duplicates`);
    }
  });
});

// ---------------------------------------------------------------------------
// generatePlaceNames / unknown culture fallback
// ---------------------------------------------------------------------------

describe("generatePlaceNames / unknown culture fallback", () => {
  it("falls back to CULTURE_PROFILES[0] for an unrecognised culture key", () => {
    const fallbackKey = CULTURE_PROFILES[0]?.key ?? "";
    const fromUnknown = generatePlaceNames({
      culture: "totally-unknown-culture",
      kind: "settlement",
      seed: 99,
    });
    const fromFallback = generatePlaceNames({
      culture: fallbackKey,
      kind: "settlement",
      seed: 99,
    });
    assert.deepEqual(fromUnknown, fromFallback);
  });

  it("still returns valid names for an unknown culture (does not throw, non-empty list)", () => {
    const names = generatePlaceNames({ culture: "nope", kind: "mountain", count: 5 });
    assert.equal(names.length, 5);
    for (const name of names) assert.ok(name.length > 0);
  });
});

// ---------------------------------------------------------------------------
// generatePlaceNames / count clamping
// ---------------------------------------------------------------------------

describe("generatePlaceNames / count clamping", () => {
  it("defaults to 8 when count is omitted", () => {
    const names = generatePlaceNames({ culture: "nordisch", kind: "settlement", seed: 5 });
    assert.equal(names.length, 8);
  });

  it("clamps below 1 up to 1", () => {
    const names = generatePlaceNames({ culture: "nordisch", kind: "settlement", seed: 5, count: 0 });
    assert.equal(names.length, 1);
    const negative = generatePlaceNames({ culture: "nordisch", kind: "settlement", seed: 5, count: -5 });
    assert.equal(negative.length, 1);
  });

  it("clamps above 24 down to 24", () => {
    const names = generatePlaceNames({ culture: "nordisch", kind: "settlement", seed: 5, count: 100 });
    assert.equal(names.length, 24);
  });

  it("respects an in-range count", () => {
    const names = generatePlaceNames({ culture: "nordisch", kind: "settlement", seed: 5, count: 3 });
    assert.equal(names.length, 3);
  });
});

// ---------------------------------------------------------------------------
// generatePlaceNames / name shape
// ---------------------------------------------------------------------------

describe("generatePlaceNames / name shape", () => {
  it("every name is non-empty, capitalized, and not whitespace-only", () => {
    for (const profile of CULTURE_PROFILES) {
      for (const kind of KINDS) {
        const names = generatePlaceNames({ culture: profile.key, kind, count: 12, seed: 4242 });
        for (const name of names) {
          assert.ok(name.trim().length > 0, `${profile.key}/${kind} produced a blank name`);
          const firstLetterMatch = name.match(/[A-Za-zÀ-ÿ]/);
          assert.ok(firstLetterMatch, `${profile.key}/${kind} name "${name}" has no letters`);
          const firstLetter = firstLetterMatch[0];
          assert.equal(
            firstLetter,
            firstLetter.toUpperCase(),
            `${profile.key}/${kind} name "${name}" must start with a capitalized letter`,
          );
        }
      }
    }
  });

  it("names contain no internal whitespace", () => {
    const names = generatePlaceNames({ culture: "wuestenland", kind: "region", count: 15, seed: 77 });
    for (const name of names) {
      assert.ok(!/\s/.test(name), `"${name}" should not contain whitespace`);
    }
  });
});
