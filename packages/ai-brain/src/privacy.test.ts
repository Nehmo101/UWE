import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contextContainsLocalKnowledge,
  resolveServerAllowDmOnly,
  validateProviderForContext,
} from "./privacy";
import { AiPrivacyError } from "./types";
import type { AiContext } from "./types";

function emptyContext(overrides: Partial<AiContext> = {}): AiContext {
  return {
    taskType: "summarize_page",
    worldId: "w1",
    primaryPageId: "p1",
    pages: [],
    sources: [],
    promptContext: "",
    truncated: false,
    datenschutzMode: false,
    allowDmOnly: false,
    ...overrides,
  };
}

describe("privacy — local knowledge detection", () => {
  it("detects campaign text in promptContext", () => {
    assert.equal(
      contextContainsLocalKnowledge(emptyContext({ promptContext: "# Welt: Test" })),
      true,
    );
  });

  it("empty context has no local knowledge", () => {
    assert.equal(contextContainsLocalKnowledge(emptyContext()), false);
  });
});

describe("privacy — resolveServerAllowDmOnly", () => {
  it("never allows DM-only for cloud route", () => {
    assert.equal(resolveServerAllowDmOnly({ localOnly: true }, true), false);
  });

  it("blocks DM-only for player-safe tasks", () => {
    assert.equal(resolveServerAllowDmOnly({ localOnly: true }, false, true), false);
  });

  it("allows DM-only only when localOnly and local route", () => {
    assert.equal(resolveServerAllowDmOnly({ localOnly: true }, false), true);
    assert.equal(resolveServerAllowDmOnly({ localOnly: false }, false), false);
  });
});

describe("privacy — cloud provider validation", () => {
  it("blocks cloud when context has pages", () => {
    assert.throws(
      () =>
        validateProviderForContext(
          "openai",
          emptyContext({
            pages: [
              {
                pageId: "p1",
                title: "Test",
                pageType: "npc",
                visibility: "player_visible",
                canonicalStatus: "canon",
                summary: null,
                tags: [],
                aliases: [],
                contentBlocks: [
                  { blockId: "b1", type: "text", visibility: "player_visible", content: "Hello" },
                ],
              },
            ],
          }),
          { datenschutzMode: false, localOnly: false },
        ),
      (error: unknown) => error instanceof AiPrivacyError,
    );
  });

  it("allows cloud for empty context", () => {
    assert.doesNotThrow(() =>
      validateProviderForContext("openai", emptyContext(), {
        datenschutzMode: false,
        localOnly: false,
      }),
    );
  });
});
