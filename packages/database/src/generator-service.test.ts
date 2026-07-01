import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectMissingContent,
  listGeneratorActions,
  resolveGeneratorContextFromPage,
} from "./generator-service";

describe("generator service", () => {
  it("resolves page context types", () => {
    const context = resolveGeneratorContextFromPage({
      pageId: "p1",
      pageType: "npc",
      pageTitle: "Gundren",
      worldId: "w1",
      worldSlug: "terra",
    });

    assert.equal(context.contextType, "npc");
    assert.equal(context.worldSlug, "terra");
  });

  it("lists contextual actions for sessions", () => {
    const actions = listGeneratorActions({
      contextType: "session",
      contextId: "s1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "prepare_next_session"));
    assert.ok(actions.every((action) => action.reviewRequired));
  });

  it("lists faction simulation for faction pages", () => {
    const actions = listGeneratorActions({
      contextType: "faction",
      contextId: "f1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "simulate_faction"));
  });

  it("detects missing NPC motivation", () => {
    const hints = detectMissingContent({
      pageType: "npc",
      summary: "",
      contentBlocks: [],
    });

    assert.ok(hints.some((hint) => hint.field === "summary"));
  });

  it("detects missing room read-aloud", () => {
    const hints = detectMissingContent({
      pageType: "room",
      contentBlocks: [{ type: "gm_note", content: "secret" }],
      prepStatus: "unprepared",
    });

    assert.ok(hints.some((hint) => hint.field === "player_text"));
  });

  it("lists structured npc generator for npc pages", () => {
    const actions = listGeneratorActions({
      contextType: "npc",
      contextId: "n1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "generate_npc"));
  });

  it("lists structured quest generator for quest pages", () => {
    const actions = listGeneratorActions({
      contextType: "quest",
      contextId: "q1",
      worldSlug: "terra",
    });

    assert.ok(actions.some((action) => action.id === "generate_quest"));
  });
});
