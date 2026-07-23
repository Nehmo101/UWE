import assert from "node:assert/strict";
import { test } from "node:test";
import { generateChronicle, type ChronicleActor } from "./chronicle";

const ACTORS: readonly ChronicleActor[] = [
  { name: "Skjaldurheim", kind: "siedlung" },
  { name: "Valencia", kind: "ort" },
];

test("chronicle is deterministic", () => {
  const a = generateChronicle({ seed: 21, actors: ACTORS });
  const b = generateChronicle({ seed: 21, actors: ACTORS });
  assert.deepEqual(a, b);
  const c = generateChronicle({ seed: 22, actors: ACTORS });
  assert.notDeepEqual(a, c, "different seed → different chronicle");
});

test("years ascend strictly and entryCount is respected", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const entries = generateChronicle({ seed, actors: ACTORS, entryCount: 11 });
    assert.equal(entries.length, 11);
    for (let i = 1; i < entries.length; i++) {
      assert.ok(entries[i].year > entries[i - 1].year, `years ascend (seed ${seed})`);
    }
    assert.ok(entries[0].year >= 12 && entries[0].year <= 380, "start year in 12..380");
  }
  assert.equal(generateChronicle({ seed: 3, actors: [] }).length, 8, "default entryCount 8");
  assert.equal(generateChronicle({ seed: 3, actors: [], entryCount: 99 }).length, 14, "capped at 14");
});

test("with two actors both names appear somewhere", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const joined = generateChronicle({ seed, actors: ACTORS })
      .map((entry) => entry.text)
      .join(" ");
    assert.ok(joined.includes("Skjaldurheim"), `actor 1 appears (seed ${seed})`);
    assert.ok(joined.includes("Valencia"), `actor 2 appears (seed ${seed})`);
  }
});

test("no placeholder ever leaks into the output", () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (const actors of [ACTORS, [] as readonly ChronicleActor[]]) {
      for (const entry of generateChronicle({ seed, actors, entryCount: 14 })) {
        assert.ok(!entry.text.includes("{") && !entry.text.includes("}"), `no placeholder in "${entry.text}"`);
        assert.ok(entry.text.length > 10, "entry is a real sentence");
      }
    }
  }
});

test("no template repeats twice in a row and era is configurable", () => {
  const entries = generateChronicle({ seed: 5, actors: ACTORS, era: "Ära der Asche", entryCount: 14 });
  const joined = entries.map((e) => e.text).join(" ");
  assert.ok(!joined.includes("Drittes Zeitalter"), "default era replaced");
  for (let i = 1; i < entries.length; i++) {
    assert.notEqual(entries[i].text, entries[i - 1].text, "no identical consecutive entries");
  }
});
