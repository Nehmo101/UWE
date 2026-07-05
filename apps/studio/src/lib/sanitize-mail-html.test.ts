import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMailImageProxyUrl, sanitizeMailBodyHtml } from "./sanitize-html";

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
    assert.equal(url, "/api/admin/mail/messages/abc/images/proxy?url=https%3A%2F%2Fexample.com%2Fa.png");
  });
});
