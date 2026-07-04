import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRawMailSource } from "./mime-decode";

function crlf(text: string): string {
  return text.replace(/\n/g, "\r\n");
}

describe("mime-decode", () => {
  it("decodes quoted-printable text/plain bodies (fixes raw =XX / =E2=80=93 artifacts)", async () => {
    const raw = crlf(
      [
        "From: DAZN <mail@nflgamepass.dazn.com>",
        "To: dm@uwe.local",
        "Subject: Kuendigung",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "Mach deine K=C3=BCndigung jetzt =E2=80=93 bevor die Saison beginnt.=20",
        "",
      ].join("\n"),
    );

    const parsed = await parseRawMailSource(Buffer.from(raw, "utf8"));
    assert.equal(parsed.bodyText, "Mach deine Kündigung jetzt – bevor die Saison beginnt.");
    assert.equal(parsed.bodyHtml, null);
    assert.deepEqual(parsed.attachments, []);
  });

  it("extracts a decoded HTML part and embeds inline cid: images as data URIs", async () => {
    const boundary = "b1";
    const raw = crlf(
      [
        "From: DAZN <mail@nflgamepass.dazn.com>",
        "To: dm@uwe.local",
        "Subject: Saison 2026",
        `Content-Type: multipart/related; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "<p>Mach deine K=C3=BCndigung jetzt.</p><img src=3D\"cid:hero@dazn\">",
        "",
        `--${boundary}`,
        "Content-Type: image/png",
        "Content-Transfer-Encoding: base64",
        "Content-ID: <hero@dazn>",
        "Content-Disposition: inline; filename=hero.png",
        "",
        Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
        "",
        `--${boundary}--`,
        "",
      ].join("\n"),
    );

    const parsed = await parseRawMailSource(Buffer.from(raw, "utf8"));
    assert.match(parsed.bodyHtml ?? "", /Kündigung/);
    assert.match(parsed.bodyHtml ?? "", /src="data:image\/png;base64,/);
    assert.doesNotMatch(parsed.bodyHtml ?? "", /cid:hero@dazn/);
    assert.equal(parsed.attachments.length, 1);
    assert.equal(parsed.attachments[0].contentId, "hero@dazn");
    assert.equal(parsed.attachments[0].mimeType, "image/png");
    assert.equal(parsed.attachments[0].filename, "hero.png");
  });

  it("caps an oversized inline-embedded HTML body instead of growing the DB unbounded", async () => {
    const boundary = "b2";
    const hugeImage = Buffer.alloc(1_600_000, 1).toString("base64");
    const raw = crlf(
      [
        "From: sender@example.com",
        "To: dm@uwe.local",
        "Subject: Huge inline image",
        `Content-Type: multipart/related; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        '<img src="cid:big@example.com">',
        "",
        `--${boundary}`,
        "Content-Type: image/png",
        "Content-Transfer-Encoding: base64",
        "Content-ID: <big@example.com>",
        "Content-Disposition: inline; filename=big.png",
        "",
        hugeImage,
        "",
        `--${boundary}--`,
        "",
      ].join("\n"),
    );

    const parsed = await parseRawMailSource(Buffer.from(raw, "utf8"));
    assert.ok((parsed.bodyHtml?.length ?? 0) <= 2_000_000);
  });
});
