import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeHtml, sanitizeMailBodyHtml } from "./sanitize-html";

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

describe("sanitizeMailBodyHtml", () => {
  it("keeps data: URI images (mailparser's inlined cid: images) untouched", () => {
    const input = '<p>Hallo</p><img src="data:image/png;base64,iVBORw0KGgo=" alt="Logo">';
    const result = sanitizeMailBodyHtml(input);
    assert.ok(result.includes('src="data:image/png;base64,iVBORw0KGgo='));
    assert.equal(result.includes("data-uwe-remote-src"), false);
  });

  it("blocks remote http(s) images by default and preserves the URL for later reveal", () => {
    const input = '<img src="https://tracker.example.com/pixel.gif" width="1" height="1">';
    const result = sanitizeMailBodyHtml(input);
    assert.equal(/(^|\s)src="https:/.test(result), false);
    assert.ok(result.includes('data-uwe-remote-src="https://tracker.example.com/pixel.gif"'));
  });

  it("strips remote srcset and background attributes", () => {
    const input =
      '<img src="data:image/png;base64,AA==" srcset="https://evil.example/2x.png 2x">' +
      '<table background="https://evil.example/bg.png"><tr><td>hi</td></tr></table>';
    const result = sanitizeMailBodyHtml(input);
    assert.equal(result.includes("srcset"), false);
    assert.equal(result.includes("background"), false);
  });

  it("strips inline style with a remote CSS url() (tracking via background-image)", () => {
    const input = '<div style="background-image:url(\'https://evil.example/spy.png\')">hi</div>';
    const result = sanitizeMailBodyHtml(input);
    assert.equal(result.includes("style="), false);
    assert.ok(result.includes("hi"));
  });

  it("keeps harmless inline styles (marketing-email layout)", () => {
    const input = '<p style="color:#333;font-size:14px">Angebot</p>';
    const result = sanitizeMailBodyHtml(input);
    assert.ok(result.includes('style="color:#333;font-size:14px"'));
  });

  it("forbids the <style> element but not the style attribute", () => {
    const input = "<style>body{display:none}</style><p style=\"color:red\">ok</p>";
    const result = sanitizeMailBodyHtml(input);
    assert.equal(result.includes("<style"), false);
    assert.ok(result.includes('style="color:red"'));
  });

  it("strips class/id to avoid colliding with host-page selectors", () => {
    const input = '<p class="uwe-danger" id="app-root">hi</p>';
    const result = sanitizeMailBodyHtml(input);
    assert.equal(result.includes("class="), false);
    assert.equal(result.includes("id="), false);
  });

  it("removes script tags like the outbound sanitizer", () => {
    const result = sanitizeMailBodyHtml('<p>Hallo</p><script>alert("xss")</script>');
    assert.equal(result.includes("<script"), false);
    assert.ok(result.includes("<p>Hallo</p>"));
  });

  it("returns empty string for empty input", () => {
    assert.equal(sanitizeMailBodyHtml(""), "");
  });
});
