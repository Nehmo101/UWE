import { assertUserProvidedFetchUrlAllowed } from "@uwe/security";
import { parseIcalEvents, type ParsedIcalEvent } from "./index";

export interface CalDavAuth {
  username?: string;
  password?: string;
}

export interface CalDavSyncOptions extends CalDavAuth {
  caldavUrl: string;
  timeoutMs?: number;
}

export interface CalDavRemoteEvent extends ParsedIcalEvent {
  href: string;
  etag: string | null;
}

export interface CalDavSyncResult {
  events: CalDavRemoteEvent[];
  remoteUids: string[];
  syncToken: string | null;
  ctag: string | null;
  method: "report" | "get";
}

function buildAuthHeader(auth: CalDavAuth): Record<string, string> {
  if (!auth.username || !auth.password) return {};
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

function formatCalDavTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractXmlTag(block: string, tag: string): string | null {
  const pattern = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`, "i");
  const match = block.match(pattern);
  return match?.[1]?.trim() ?? null;
}

export function parseMultistatusResponses(xml: string): Array<{ href: string; etag: string | null; calendarData: string | null }> {
  const responses: Array<{ href: string; etag: string | null; calendarData: string | null }> = [];
  const responseBlocks = xml.match(/<(?:[a-zA-Z0-9]+:)?response[\s\S]*?<\/(?:[a-zA-Z0-9]+:)?response>/gi) ?? [];

  for (const block of responseBlocks) {
    const hrefRaw = extractXmlTag(block, "href");
    if (!hrefRaw) continue;
    const href = decodeXmlEntities(hrefRaw);
    if (href.endsWith("/")) continue;

    const etagRaw = extractXmlTag(block, "getetag");
    const etag = etagRaw ? decodeXmlEntities(etagRaw).replace(/^"|"$/g, "") : null;
    const calendarDataRaw = extractXmlTag(block, "calendar-data");
    const calendarData = calendarDataRaw ? decodeXmlEntities(calendarDataRaw) : null;

    responses.push({ href, etag, calendarData });
  }

  return responses;
}

async function calDavRequest(
  url: string,
  method: string,
  auth: CalDavAuth,
  body: string | undefined,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<Response> {
  assertUserProvidedFetchUrlAllowed(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...buildAuthHeader(auth),
        ...headers,
      },
      body,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function propfindCalendarCollection(
  options: CalDavSyncOptions,
): Promise<{ syncToken: string | null; ctag: string | null }> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:sync-token/>
    <D:displayname/>
  </D:prop>
</D:propfind>`;

  const response = await calDavRequest(
    options.caldavUrl,
    "PROPFIND",
    options,
    body,
    { Depth: "0", "Content-Type": "application/xml; charset=utf-8" },
    timeoutMs,
  );

  if (!response.ok) {
    return { syncToken: null, ctag: null };
  }

  const xml = await response.text();
  const syncToken = extractXmlTag(xml, "sync-token");
  const ctagRaw = extractXmlTag(xml, "getetag");
  const ctag = ctagRaw ? decodeXmlEntities(ctagRaw).replace(/^"|"$/g, "") : null;
  return { syncToken: syncToken ? decodeXmlEntities(syncToken) : null, ctag };
}

export async function reportCalendarQuery(
  options: CalDavSyncOptions,
  range: { start: Date; end: Date },
): Promise<CalDavRemoteEvent[]> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatCalDavTime(range.start)}" end="${formatCalDavTime(range.end)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const response = await calDavRequest(
    options.caldavUrl,
    "REPORT",
    options,
    body,
    {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`CalDAV REPORT fehlgeschlagen (${response.status}).`);
  }

  const xml = await response.text();
  const responses = parseMultistatusResponses(xml);
  const events: CalDavRemoteEvent[] = [];

  for (const item of responses) {
    if (!item.calendarData) continue;
    const parsed = parseIcalEvents(item.calendarData);
    for (const event of parsed) {
      events.push({
        ...event,
        href: item.href,
        etag: item.etag,
      });
    }
  }

  return events;
}

export async function fetchCalDavEventsViaGet(
  options: CalDavSyncOptions,
): Promise<ParsedIcalEvent[]> {
  assertUserProvidedFetchUrlAllowed(options.caldavUrl);
  const timeoutMs = options.timeoutMs ?? 20000;
  const response = await calDavRequest(
    options.caldavUrl,
    "GET",
    options,
    undefined,
    { Accept: "text/calendar, application/calendar+json, */*" },
    timeoutMs,
  );
  if (!response.ok) {
    throw new Error(`CalDAV GET fehlgeschlagen (${response.status}).`);
  }
  const content = await response.text();
  return parseIcalEvents(content);
}

/** PROPFIND + REPORT calendar-query with GET fallback. */
export async function syncCalDavCollection(options: CalDavSyncOptions): Promise<CalDavSyncResult> {
  const now = new Date();
  const range = {
    start: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    end: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()),
  };

  let syncToken: string | null = null;
  let ctag: string | null = null;
  try {
    const props = await propfindCalendarCollection(options);
    syncToken = props.syncToken;
    ctag = props.ctag;
  } catch {
    // PROPFIND optional — continue with REPORT/GET
  }

  try {
    const events = await reportCalendarQuery(options, range);
    return {
      events,
      remoteUids: events.map((event) => event.uid),
      syncToken,
      ctag,
      method: "report",
    };
  } catch {
    const parsed = await fetchCalDavEventsViaGet(options);
    const base = options.caldavUrl.replace(/\/$/, "");
    const events: CalDavRemoteEvent[] = parsed.map((event) => ({
      ...event,
      href: `${base}/${encodeURIComponent(`${event.uid}.ics`)}`,
      etag: null,
    }));
    return {
      events,
      remoteUids: events.map((event) => event.uid),
      syncToken,
      ctag,
      method: "get",
    };
  }
}
