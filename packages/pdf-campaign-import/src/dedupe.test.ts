import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeEntitiesByTitle } from "./dedupe";

describe("dedupeEntitiesByTitle", () => {
  it("keeps the first title across case and whitespace variants", () => {
    const entities = [
      { kind: "npc" as const, title: "  Die   Wirtin ", body: "Erste Fassung" },
      { kind: "npc" as const, title: "die wirtin", body: "Zweite Fassung" },
      { kind: "location" as const, title: "Nordtor", body: "Ein Tor" },
    ];

    assert.deepEqual(
      dedupeEntitiesByTitle(entities).map((entity) => entity.body),
      ["Erste Fassung", "Ein Tor"],
    );
  });
});
