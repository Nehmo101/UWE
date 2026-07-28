import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSeedPageBlocks,
  getWorldTemplate,
  listWorldTemplateOptions,
  resolveWorldTemplateId,
  seedPageDefaults,
} from "./world-templates";

describe("world template catalog", () => {
  it("lists all archetypes with seed metadata", () => {
    const options = listWorldTemplateOptions();
    assert.deepEqual(
      options.map((entry) => entry.id),
      ["blank", "dnd", "wiki", "roman", "wargame"],
    );

    const dnd = options.find((entry) => entry.id === "dnd");
    assert.ok(dnd);
    assert.equal(dnd.seedPageCount, 5);
    assert.equal(dnd.includesCampaign, true);
    assert.equal(dnd.includesCalendar, true);

    const wargame = options.find((entry) => entry.id === "wargame");
    assert.ok(wargame);
    assert.equal(wargame.seedPageCount, 5);
    assert.equal(wargame.includesCampaign, true);
    assert.equal(wargame.includesCalendar, true);
  });

  it("falls back to blank for unknown template ids", () => {
    assert.equal(resolveWorldTemplateId("unknown"), "blank");
    assert.equal(getWorldTemplate("unknown"), null);
  });
});

describe("world template seed helpers", () => {
  it("builds starter blocks with custom content on first block", () => {
    const blocks = buildSeedPageBlocks({
      title: "Übersicht",
      pageTemplateId: "blank",
      starterContent: "Custom intro",
    });
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.content, "Custom intro");
  });

  it("uses page template defaults for wargame faction seed", () => {
    const seed = getWorldTemplate("wargame")?.seedPages.find((page) => page.slug === "spielerarmee");
    assert.ok(seed);
    const defaults = seedPageDefaults(seed);
    assert.equal(defaults.pageType, "faction");
  });
});
