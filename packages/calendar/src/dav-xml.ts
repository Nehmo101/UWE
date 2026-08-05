/**
 * WebDAV/CalDAV-XML für die Server-Seite: Multistatus-Antworten bauen und die
 * schmalen Request-Bodies (PROPFIND, calendar-query, calendar-multiget) lesen.
 *
 * Das Parsing ist bewusst regex-pragmatisch — gleiche Flughöhe wie der
 * bestehende Multistatus-*Parser* der Client-Seite (`caldav-sync.ts`). Der
 * einzige Client, der bedient werden muss, ist der iOS-Kalender.
 */

export const DAV_NS = "DAV:";
export const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";
export const CALENDARSERVER_NS = "http://calendarserver.org/ns/";
export const APPLE_ICAL_NS = "http://apple.com/ns/ical/";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/**
 * Eine gefundene Property: `tag` ist der qualifizierte Elementname mit den
 * Präfixen des Multistatus-Roots (`D:` = DAV, `C:` = CalDAV, `CS:` =
 * calendarserver, `A:` = Apple), `inner` der fertige XML-Inhalt (bereits
 * escaped).
 */
export interface DavProp {
  tag: string;
  inner: string;
}

export interface MultistatusResponse {
  href: string;
  /** Properties mit Status 200. */
  found?: readonly DavProp[];
  /** Angefragte, aber unbekannte Property-Namen (lokale Namen) — Status 404. */
  notFound?: readonly string[];
  /** Gesamt-Status statt propstat (z. B. 404 bei calendar-multiget-Misses). */
  status?: number;
}

const STATUS_LINE: Record<number, string> = {
  200: "HTTP/1.1 200 OK",
  404: "HTTP/1.1 404 Not Found",
};

function statusLine(status: number): string {
  return STATUS_LINE[status] ?? `HTTP/1.1 ${status} Status`;
}

/** 207-Multistatus-Body. iOS erwartet unbekannte Props als 404-propstat. */
export function buildMultistatus(responses: readonly MultistatusResponse[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<D:multistatus xmlns:D="${DAV_NS}" xmlns:C="${CALDAV_NS}" xmlns:CS="${CALENDARSERVER_NS}" xmlns:A="${APPLE_ICAL_NS}">`,
  ];

  for (const response of responses) {
    lines.push("<D:response>");
    lines.push(`<D:href>${escapeXml(response.href)}</D:href>`);

    if (response.status != null) {
      lines.push(`<D:status>${statusLine(response.status)}</D:status>`);
    } else {
      if (response.found && response.found.length > 0) {
        lines.push("<D:propstat>");
        lines.push("<D:prop>");
        for (const prop of response.found) {
          lines.push(
            prop.inner === "" ? `<${prop.tag}/>` : `<${prop.tag}>${prop.inner}</${prop.tag}>`,
          );
        }
        lines.push("</D:prop>");
        lines.push(`<D:status>${statusLine(200)}</D:status>`);
        lines.push("</D:propstat>");
      }
      if (response.notFound && response.notFound.length > 0) {
        lines.push("<D:propstat>");
        lines.push("<D:prop>");
        for (const name of response.notFound) {
          const safe = name.replace(/[^A-Za-z0-9_-]/g, "");
          if (safe) lines.push(`<D:${safe}/>`);
        }
        lines.push("</D:prop>");
        lines.push(`<D:status>${statusLine(404)}</D:status>`);
        lines.push("</D:propstat>");
      }
    }

    lines.push("</D:response>");
  }

  lines.push("</D:multistatus>");
  return lines.join("\n");
}

/**
 * Angefragte Property-Namen (lokale Namen, ohne Namespace) aus einem
 * PROPFIND-Body. `null` = allprop (leerer Body, `<allprop/>` oder kein
 * `<prop>`-Block) — dann antwortet der Server mit allem, was er kennt.
 */
export function parsePropfindProps(xml: string): string[] | null {
  const trimmed = xml.trim();
  if (trimmed === "") return null;
  if (/<(?:[A-Za-z0-9_-]+:)?allprop\b/.test(trimmed)) return null;

  const propBlock = trimmed.match(/<(?:[A-Za-z0-9_-]+:)?prop[\s>]([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?prop>/);
  if (!propBlock?.[1]) return null;

  const names: string[] = [];
  const elementRe = /<(?:([A-Za-z0-9_-]+):)?([A-Za-z0-9_-]+)(?:\s[^>]*)?\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = elementRe.exec(propBlock[1])) !== null) {
    const local = match[2];
    if (local && !names.includes(local)) names.push(local);
  }
  return names;
}

/** Alle `<href>`-Werte eines calendar-multiget-Bodies, XML-entschärft. */
export function parseMultigetHrefs(xml: string): string[] {
  const hrefs: string[] = [];
  const hrefRe = /<(?:[A-Za-z0-9_-]+:)?href>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?href>/g;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(xml)) !== null) {
    const value = unescapeXml((match[1] ?? "").trim());
    if (value) hrefs.push(value);
  }
  return hrefs;
}

function parseIcalUtcStamp(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!match) return undefined;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
  );
}

/** `<time-range start="…" end="…"/>` aus einem calendar-query-Body. */
export function parseCalendarQueryTimeRange(
  xml: string,
): { start?: Date; end?: Date } | null {
  const match = xml.match(/<(?:[A-Za-z0-9_-]+:)?time-range\b([^>]*)\/?>/);
  if (!match?.[1]) return null;
  const attrs = match[1];
  const start = parseIcalUtcStamp(attrs.match(/start="([^"]+)"/)?.[1]);
  const end = parseIcalUtcStamp(attrs.match(/end="([^"]+)"/)?.[1]);
  if (!start && !end) return null;
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}
