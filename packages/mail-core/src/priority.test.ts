import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreMailPriority } from "./priority";

describe("mail-priority-service", () => {
  it("flags urgent keywords", () => {
    const result = scoreMailPriority({
      subject: "DRINGEND: Vertrag bis Freitag",
      fromAddress: "legal@example.com",
      bodyText: "Bitte umgehend antworten.",
    });
    assert.equal(result.category, "urgent");
    assert.ok(result.priority >= 70);
    assert.ok(result.ruleSignals.some((s) => s.includes("Dringlichkeitswörter")));
  });

  it("detects newsletter senders", () => {
    const result = scoreMailPriority({
      subject: "Weekly digest",
      fromAddress: "newsletter@noreply.example.com",
      bodyText: "Unsubscribe here",
    });
    assert.equal(result.category, "newsletter");
    assert.ok(result.priority <= 30);
  });

  it("boosts VIP senders", () => {
    const result = scoreMailPriority({
      subject: "Kurzes Update",
      fromAddress: "boss@company.com",
      bodyText: "FYI",
      vipSenders: ["boss@company.com"],
    });
    assert.ok(result.ruleSignals.some((s) => s.includes("VIP")));
    assert.ok(result.priority > 50);
  });
});
