import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMailPriorityResponse } from "./mail-priority-parse";

describe("parseMailPriorityResponse", () => {
  it("parses a clean JSON response", () => {
    const parsed = parseMailPriorityResponse(
      JSON.stringify({
        priority: 85,
        category: "urgent",
        confidence: 0.9,
        explanation: "Mahnung mit Frist.",
        extractedActions: [{ type: "deadline", label: "Zahlung bis 15.07." }],
      }),
    );

    assert.ok(parsed);
    assert.equal(parsed.priority, 85);
    assert.equal(parsed.category, "urgent");
    assert.equal(parsed.confidence, 0.9);
    assert.equal(parsed.extractedActions.length, 1);
  });

  it("parses JSON wrapped in code fences and prose", () => {
    const parsed = parseMailPriorityResponse(
      'Hier die Bewertung:\n```json\n{"priority": 30, "category": "newsletter", "confidence": 0.8, "explanation": "Werbung."}\n```',
    );
    assert.ok(parsed);
    assert.equal(parsed.category, "newsletter");
  });

  it("clamps out-of-range values", () => {
    const parsed = parseMailPriorityResponse(
      '{"priority": 250, "category": "info", "confidence": 3, "explanation": "x"}',
    );
    assert.ok(parsed);
    assert.equal(parsed.priority, 100);
    assert.equal(parsed.confidence, 1);
  });

  it("rejects unknown categories", () => {
    assert.equal(
      parseMailPriorityResponse('{"priority": 10, "category": "banana", "confidence": 1, "explanation": "x"}'),
      null,
    );
  });

  it("rejects non-JSON responses", () => {
    assert.equal(parseMailPriorityResponse("Keine Ahnung."), null);
  });
});
