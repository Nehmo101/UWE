import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreMailPriority } from "@uwe/database/server";

describe("admin mail portal API contracts", () => {
  it("scores mail priority without throwing", () => {
    const result = scoreMailPriority({
      subject: "Rechnung #123",
      fromAddress: "billing@example.com",
      bodyText: "Bitte bis Freitag zahlen.",
      hasAttachments: true,
    });
    assert.ok(result.priority >= 0);
    assert.ok(result.explanation.length > 0);
  });
});
