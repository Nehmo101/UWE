import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mailBodyForProcessing, sanitizeMailHtml } from "./mail-portal-types";

describe("sanitizeMailHtml", () => {
  it("removes script tags and HTML", () => {
    const input = '<p>Hello</p><script>alert("x")</script><b>World</b>';
    assert.equal(sanitizeMailHtml(input), "Hello World");
  });

  it("prefers plain text in mailBodyForProcessing", () => {
    assert.equal(
      mailBodyForProcessing("Plain body", "<p>HTML</p>"),
      "Plain body",
    );
  });
});
