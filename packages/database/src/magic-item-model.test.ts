import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildItemSubtitle,
  parseMagicItemData,
  rarityLabel,
  toFiveToolsJson,
  toHomebrewery,
  toPlayerHandout,
  toPlayerSafeData,
  type MagicItemData,
} from "./magic-item-model";

const sword: MagicItemData = {
  itemType: "Waffe (Langschwert)",
  rarity: "rare",
  requiresAttunement: true,
  attunementNote: "durch einen Zauberwirker",
  visibleDescription: "Eine Klinge, die im Dunkeln schwach blau leuchtet.",
  properties: ["+1 auf Angriffs- und Schadenswürfe"],
  dmSecret: "Die Klinge ist an eine gefangene Seele gebunden.",
  curse: "Wer sie zieht, kann sie nicht mehr freiwillig ablegen.",
};

describe("magic item formatting (pure)", () => {
  it("labels rarity in German and falls back for unknown values", () => {
    assert.equal(rarityLabel("legendary"), "legendär");
    assert.equal(rarityLabel("homebrew-rarity"), "homebrew-rarity");
    assert.equal(rarityLabel(undefined), "");
  });

  it("builds a 5e-style subtitle with attunement", () => {
    assert.equal(
      buildItemSubtitle(sword),
      "Waffe (Langschwert), selten (erfordert Einstimmung durch einen Zauberwirker)",
    );
  });

  it("DM Homebrewery includes curse and secret; player handout does not", () => {
    const dm = toHomebrewery("Seelenklinge", sword, true);
    assert.match(dm, /Fluch/);
    assert.match(dm, /DM-Geheimnis/);

    const player = toPlayerHandout("Seelenklinge", sword);
    assert.doesNotMatch(player, /Fluch/);
    assert.doesNotMatch(player, /DM-Geheimnis/);
    assert.match(player, /schwach blau leuchtet/);
  });

  it("5etools JSON excludes secrets by default and maps rarity/attunement", () => {
    const json = toFiveToolsJson("Seelenklinge", sword);
    assert.equal(json.rarity, "rare");
    assert.equal(json.reqAttune, "durch einen Zauberwirker");
    assert.ok(Array.isArray(json.entries));
    assert.ok(!(json.entries as string[]).some((e) => e.includes("Fluch")));

    const dmJson = toFiveToolsJson("Seelenklinge", sword, true);
    assert.ok((dmJson.entries as string[]).some((e) => e.includes("Fluch")));
  });

  it("toPlayerSafeData strips DM fields", () => {
    const safe = toPlayerSafeData(sword);
    assert.equal(safe.dmSecret, undefined);
    assert.equal(safe.curse, undefined);
    assert.equal(safe.visibleDescription, sword.visibleDescription);
  });

  it("parseMagicItemData is defensive about junk input", () => {
    assert.deepEqual(parseMagicItemData(null), {});
    assert.deepEqual(parseMagicItemData("nope"), {});
    const parsed = parseMagicItemData({ rarity: "rare", properties: ["a", 5, "b"], requiresAttunement: true });
    assert.equal(parsed.rarity, "rare");
    assert.deepEqual(parsed.properties, ["a", "b"]);
    assert.equal(parsed.requiresAttunement, true);
  });
});
