import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeHtml } from "./sanitize-html";

describe("sanitizeHtml", () => {
  it("removes script tags and their content", () => {
    const result = sanitizeHtml('<p>Hallo</p><script>alert("xss")</script>');
    assert.equal(result.includes("<script"), false);
    assert.equal(result.includes("alert"), false);
    assert.ok(result.includes("<p>Hallo</p>"));
  });

  it("strips event-handler attributes", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)"><b onclick="alert(2)">fett</b>');
    assert.equal(result.includes("onerror"), false);
    assert.equal(result.includes("onclick"), false);
    assert.ok(result.includes("fett"));
  });

  it("strips javascript: URLs", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">klick</a>');
    assert.equal(result.includes("javascript:"), false);
    assert.ok(result.includes("klick"));
  });

  it("removes style/iframe containers", () => {
    const result = sanitizeHtml("<style>body{display:none}</style><iframe src=\"https://evil.example\"></iframe><p>ok</p>");
    assert.equal(result.includes("<style"), false);
    assert.equal(result.includes("<iframe"), false);
    assert.ok(result.includes("<p>ok</p>"));
  });

  it("keeps common formatting markup", () => {
    const input =
      '<h2>Titel</h2><p><strong>fett</strong> und <em>kursiv</em></p><ul><li>Punkt</li></ul><a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    assert.ok(result.includes("<h2>Titel</h2>"));
    assert.ok(result.includes("<strong>fett</strong>"));
    assert.ok(result.includes("<em>kursiv</em>"));
    assert.ok(result.includes("<li>Punkt</li>"));
    assert.ok(result.includes('href="https://example.com"'));
  });

  it("returns empty string for empty input", () => {
    assert.equal(sanitizeHtml(""), "");
  });
});
