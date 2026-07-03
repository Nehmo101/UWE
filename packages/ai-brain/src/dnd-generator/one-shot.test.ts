import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOneShotOutline,
  ONE_SHOT_TONES,
  serializeOneShotOutline,
  type OneShotInput,
} from "./one-shot";

function input(overrides: Partial<OneShotInput> = {}): OneShotInput {
  return {
    worldName: "Terra",
    worldSlug: "terra",
    locationName: "Hafenviertel",
    tone: "mystery",
    npcs: [{ name: "Magister Rell", role: "Auftraggeber" }],
    ...overrides,
  };
}

describe("buildOneShotOutline (pure)", () => {
  it("weaves location and anchor NPC into hook and player brief", () => {
    const outline = buildOneShotOutline(input());
    assert.match(outline.hook, /Hafenviertel/);
    assert.match(outline.playerBrief, /Magister Rell/);
    assert.match(outline.title, /Hafenviertel/);
  });

  it("keeps the twist out of the player brief but in DM secrets", () => {
    const outline = buildOneShotOutline(input());
    assert.ok(outline.dmSecrets.some((s) => /Twist/.test(s)));
    assert.doesNotMatch(outline.playerBrief, /Twist/);
  });

  it("varies atmosphere/encounter by tone", () => {
    const horror = buildOneShotOutline(input({ tone: "horror" }));
    const funny = buildOneShotOutline(input({ tone: "lustig" }));
    assert.notEqual(horror.encounter, funny.encounter);
    assert.match(horror.loot, /verstörend|Artefakt/);
  });

  it("emits Terra canon warnings and player-knowledge caution", () => {
    const outline = buildOneShotOutline(input({ worldSlug: "terra" }));
    assert.ok(outline.canonWarnings.some((w) => /Terra-Kanon/.test(w)));
    assert.ok(outline.canonWarnings.some((w) => /Spielerwissen/.test(w)));
  });

  it("handles no NPCs gracefully", () => {
    const outline = buildOneShotOutline(input({ npcs: [] }));
    assert.equal(outline.involvedNpcs.length, 0);
    assert.match(outline.playerBrief, /lokaler Kontakt/);
  });

  it("adds a second-NPC agenda secret when multiple NPCs are chosen", () => {
    const outline = buildOneShotOutline(
      input({ npcs: [{ name: "Rell" }, { name: "Vayra" }] }),
    );
    assert.ok(outline.dmSecrets.some((s) => /Vayra/.test(s)));
  });

  it("serializes a markdown outline with player and DM sections", () => {
    const md = serializeOneShotOutline(buildOneShotOutline(input()));
    assert.match(md, /## Spieler-Brief/);
    assert.match(md, /## DM-Geheimnisse/);
    assert.match(md, /## Kanon-Warnungen/);
  });

  it("covers every tone without throwing", () => {
    for (const tone of ONE_SHOT_TONES) {
      const outline = buildOneShotOutline(input({ tone }));
      assert.ok(outline.scenes.length >= 3);
    }
  });
});
