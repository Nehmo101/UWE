import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coerceRollTableEntries,
  parseRollTableEntries,
  rollDice,
  rollOnTable,
  serializeRollTableEntries,
} from "./roll";

describe("roll tables", () => {
  it("parses entries with optional weights", () => {
    const entries = parseRollTableEntries("Goldbeutel | 3\nSchlüssel\n  \nDolch | abc");
    assert.deepEqual(entries, [
      { label: "Goldbeutel", weight: 3 },
      { label: "Schlüssel", weight: undefined },
      { label: "Dolch", weight: undefined },
    ]);
  });

  it("serializes entries back into editable text", () => {
    const text = serializeRollTableEntries([
      { label: "Goldbeutel", weight: 3 },
      { label: "Schlüssel" },
    ]);
    assert.equal(text, "Goldbeutel | 3\nSchlüssel");
  });

  it("coerces JSON values defensively", () => {
    assert.deepEqual(coerceRollTableEntries(null), []);
    assert.deepEqual(coerceRollTableEntries([{ label: " A ", weight: 2 }, { nope: 1 }]), [
      { label: "A", weight: 2 },
    ]);
  });

  it("rolls weighted entries deterministically with injected RNG", () => {
    const entries = [
      { label: "Selten", weight: 1 },
      { label: "Häufig", weight: 9 },
    ];

    const low = rollOnTable(entries, () => 0.05);
    assert.equal(low?.entry.label, "Selten");

    const high = rollOnTable(entries, () => 0.5);
    assert.equal(high?.entry.label, "Häufig");
    assert.equal(high?.totalWeight, 10);
  });

  it("returns null for empty tables", () => {
    assert.equal(rollOnTable([]), null);
  });

  it("rolls dice notation", () => {
    const result = rollDice("3d6+2", () => 0.999);
    assert.ok(result);
    assert.deepEqual(result.rolls, [6, 6, 6]);
    assert.equal(result.total, 20);

    assert.equal(rollDice("kein-würfel"), null);
    assert.ok(rollDice("d20", () => 0));
  });
});
