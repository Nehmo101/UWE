import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveQuestBacklinks, deriveQuestRelations } from "./quest-relations";

/*
 * Pure Tests gegen handgebaute Graph-Fragmente — der echte Graph kommt aus
 * getWorldWikiGraph; hier zählt nur die Gruppierungs- und Dedupe-Logik.
 */

function page(id: string, title: string, type: string) {
  return { id, title, slug: title.toLowerCase(), type } as never;
}

describe("deriveQuestRelations (pure)", () => {
  it("groups resolved wikilink targets by page type and dedupes", () => {
    const graph = {
      pageIndex: [
        page("n1", "Grimm", "npc"),
        page("l1", "Hafen", "location"),
        page("f1", "Rote-Hand", "faction"),
        page("x1", "Regelseite", "rule"),
      ],
      blockTargets: new Map([
        ["b1", ["n1", "l1", "n1"]],
        ["b2", ["f1", "x1", "n1"]],
      ]),
    };
    const quest = {
      contentBlocks: [{ id: "b1" }, { id: "b2" }],
    } as never;

    const relations = deriveQuestRelations("welt", quest, graph as never);
    assert.deepEqual(
      relations.npcs.map((target) => target.id),
      ["n1"],
    );
    assert.deepEqual(
      relations.locations.map((target) => target.id),
      ["l1"],
    );
    assert.deepEqual(
      relations.factions.map((target) => target.id),
      ["f1"],
    );
    assert.ok(relations.npcs[0].href.includes("/worlds/welt/"));
  });
});

describe("deriveQuestBacklinks (pure)", () => {
  it("finds pages whose blocks resolve to the quest", () => {
    const graph = {
      pages: [
        { id: "p1", title: "Ort A", slug: "ort-a", type: "location", contentBlocks: [{ id: "b1" }] },
        { id: "p2", title: "Ort B", slug: "ort-b", type: "location", contentBlocks: [{ id: "b2" }] },
        { id: "quest", title: "Quest", slug: "quest", type: "quest", contentBlocks: [{ id: "b3" }] },
      ],
      blockTargets: new Map([
        ["b1", ["quest"]],
        ["b2", ["p1"]],
        ["b3", ["p1"]],
      ]),
    };
    const backlinks = deriveQuestBacklinks("welt", "quest", graph as never);
    assert.deepEqual(
      backlinks.map((target) => target.id),
      ["p1"],
    );
  });
});
