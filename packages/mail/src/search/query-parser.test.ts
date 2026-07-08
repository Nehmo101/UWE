import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMailQuery, buildFtsMatchExpression } from "./query-parser";

describe("parseMailQuery", () => {
  it("extracts operators and leaves free text", () => {
    const parsed = parseMailQuery("from:boss@corp.de has:attachment rechnung mahnung");
    assert.equal(parsed.from, "boss@corp.de");
    assert.equal(parsed.hasAttachment, true);
    assert.equal(parsed.text, "rechnung mahnung");
  });

  it("parses before/after dates", () => {
    const parsed = parseMailQuery("after:2026-01-01 before:2026-02-01 report");
    assert.equal(parsed.after?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(parsed.before?.toISOString(), "2026-02-01T00:00:00.000Z");
    assert.equal(parsed.text, "report");
  });

  it("keeps quoted phrases together", () => {
    const parsed = parseMailQuery('"jahres abschluss" 2026');
    assert.equal(parsed.text, "jahres abschluss 2026");
  });

  it("returns empty structure for blank input", () => {
    const parsed = parseMailQuery("  ");
    assert.equal(parsed.text, "");
    assert.equal(parsed.from, null);
    assert.equal(parsed.hasAttachment, false);
  });
});

describe("buildFtsMatchExpression", () => {
  it("quotes and prefix-matches each term", () => {
    assert.equal(buildFtsMatchExpression("rechnung mahnung"), '"rechnung"* AND "mahnung"*');
  });

  it("strips embedded quotes so FTS operators cannot be injected", () => {
    assert.equal(buildFtsMatchExpression('foo" OR "bar'), '"foo"* AND "OR"* AND "bar"*');
  });

  it("returns null when there is no usable term", () => {
    assert.equal(buildFtsMatchExpression("   "), null);
  });
});
