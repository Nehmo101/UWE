import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMailImageProxyUrl, sanitizeMailBodyHtml } from "./mail-html";

describe("sanitizeMailBodyHtml", () => {
  it("stores remote image src in data attribute by default", () => {
    const html = '<img src="https://cdn.example.com/pixel.gif" alt="x">';
    const sanitized = sanitizeMailBodyHtml(html, { messageId: "msg-1" });
    assert.match(sanitized, /data-uwe-remote-src="https:\/\/cdn\.example\.com\/pixel\.gif"/);
    assert.doesNotMatch(sanitized, /\ssrc="/);
  });

  it("rewrites protocol-relative images when revealing", () => {
    const html = '<img src="//cdn.example.com/logo.png" alt="logo">';
    const sanitized = sanitizeMailBodyHtml(html, {
      messageId: "msg-2",
      revealRemoteImages: true,
    });
    const expected = buildMailImageProxyUrl("msg-2", "https://cdn.example.com/logo.png");
    assert.match(sanitized, new RegExp(`src="${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  });

  it("builds same-origin proxy URLs", () => {
    const url = buildMailImageProxyUrl("abc", "https://example.com/a.png");
    assert.equal(url, "/api/mail/messages/abc/images/proxy?url=https%3A%2F%2Fexample.com%2Fa.png");
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
