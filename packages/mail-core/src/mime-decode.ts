import { simpleParser } from "mailparser";

export interface ParsedMailAttachment {
  filename: string | null;
  mimeType: string;
  sizeBytes: number;
  /** Content-ID (without angle brackets), set when this part is referenced inline via `cid:` in the HTML body. */
  contentId: string | null;
}

export interface ParsedMailMessage {
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: ParsedMailAttachment[];
}

/**
 * mailparser embeds `cid:`-referenced inline images directly into `bodyHtml`
 * as `data:` URIs (see mailparser's `updateImageLinks`), so a single
 * image-heavy marketing email can't be allowed to grow the DB unbounded.
 */
const MAX_BODY_HTML_CHARS = 2_000_000;

function stripAngleBrackets(value: string): string {
  return value.replace(/^</, "").replace(/>$/, "");
}

/**
 * Parses a raw RFC 822 message source into decoded plain-text/HTML bodies and
 * attachment metadata. Delegates all Content-Transfer-Encoding
 * (quoted-printable, base64) and charset decoding to mailparser instead of
 * the previous hand-rolled regex, which produced raw undecoded bytes
 * (`=E2=80=93`, `=20`, …) for any non-7bit-plain message.
 */
export async function parseRawMailSource(source: Buffer): Promise<ParsedMailMessage> {
  const parsed = await simpleParser(source, { skipHtmlToText: true });

  let bodyHtml = typeof parsed.html === "string" ? parsed.html.trim() : "";
  if (bodyHtml.length > MAX_BODY_HTML_CHARS) {
    bodyHtml = bodyHtml.slice(0, MAX_BODY_HTML_CHARS);
  }

  const bodyText = parsed.text ? parsed.text.trim() : null;

  const attachments: ParsedMailAttachment[] = (parsed.attachments ?? []).map((attachment) => ({
    filename: attachment.filename?.trim() || null,
    mimeType: attachment.contentType || "application/octet-stream",
    sizeBytes: attachment.size ?? attachment.content.length,
    contentId: attachment.cid
      ? stripAngleBrackets(attachment.cid)
      : attachment.contentId
        ? stripAngleBrackets(attachment.contentId)
        : null,
  }));

  return { bodyText, bodyHtml: bodyHtml || null, attachments };
}
