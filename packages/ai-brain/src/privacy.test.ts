import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contextContainsLocalKnowledge,
  extractDmOnlyPhrases,
  validatePlayerRecapContent,
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

describe("privacy — player recap must not echo GM session text", () => {
  const session = {
    sessionId: "s1",
    title: "Der Turm",
    sessionNumber: 3,
    date: null,
    status: "summarized" as const,
    summaryDm: "Der Magister ist in Wahrheit ein Doppelgänger.",
    summaryPlayer: null,
    notes: "Nepurga zieht die Fäden.",
    openPlots: null,
    playerDecisions: null,
    linkedPageIds: [],
  };

  it("collects the session's GM-only fields as forbidden phrases", () => {
    const phrases = extractDmOnlyPhrases(emptyContext({ session }));
    assert.deepEqual(phrases, [session.summaryDm, session.notes]);
  });

  it("collects nothing without a session", () => {
    assert.deepEqual(extractDmOnlyPhrases(emptyContext()), []);
  });

  it("rejects a recap that repeats a GM phrase", () => {
    assert.throws(
      () =>
        validatePlayerRecapContent(
          "Die Gruppe erfuhr: Der Magister ist in Wahrheit ein Doppelgänger.",
          extractDmOnlyPhrases(emptyContext({ session })),
        ),
      (error: unknown) => error instanceof AiPrivacyError,
    );
  });

  it("accepts a recap that stays on player-facing events", () => {
    assert.doesNotThrow(() =>
      validatePlayerRecapContent(
        "Die Gruppe erreichte den Turm und sprach mit dem Magister.",
        extractDmOnlyPhrases(emptyContext({ session })),
      ),
    );
  });
});
