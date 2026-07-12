import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseServiceJournal } from "./service-journal";
import { collectConfigFacts } from "./config-facts";

describe("service journal parsing", () => {
  it("parses short-iso journal lines newest-first", () => {
    const stdout = [
      "2026-07-11T10:00:00+0200 uwe-host uwe[1]: started",
      "2026-07-11T10:01:00+0200 uwe-host uwe[1]: ready",
    ].join("\n");
    const lines = parseServiceJournal(stdout);
    assert.equal(lines.length, 2);
    assert.equal(lines[0].message, "uwe-host uwe[1]: ready");
    assert.equal(lines[0].timestamp, "2026-07-11T10:01:00+0200");
  });
});

describe("config facts", () => {
  it("marks missing env file unavailable", async () => {
    const facts = await collectConfigFacts("/tmp/uwe-hcc-test-missing-env-file-404");
    assert.equal(facts.available, false);
  });
});
