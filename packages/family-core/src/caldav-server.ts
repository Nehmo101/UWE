/**
 * CalDAV-Server-Dispatcher für den Haushalts-Kalender.
 *
 * Framework-frei: nimmt eine bereits authentifizierte Anfrage als schlichtes
 * Objekt (Methode, ggf. übersetzte DAV-Methode, Pfad, Body, Header) und gibt
 * Status/Header/Body zurück. Die Next-Route in `apps/family` ist nur noch
 * Transport; getestet wird direkt gegen diesen Dispatcher.
 *
 * Bedient wird genau der iOS-Kalender: OPTIONS, PROPFIND (Discovery und
 * Enumeration), REPORT (calendar-query, calendar-multiget) sowie GET/PUT/
 * DELETE auf Einzelterminen. Erreichbar ist ausschliesslich der lokale Feed —
 * dieselbe Invariante wie in den Family-Server-Actions (`assertLocalEvent`).
 */
import {
  buildMultistatus,
  escapeXml,
  parseCalendarQueryTimeRange,
  parseMultigetHrefs,
  parsePropfindProps,
  type DavProp,
  type MultistatusResponse,
} from "@uwe/calendar";
import type { FamilyPrismaClient } from "@uwe/database/family-client";
import { attachMembersToEvents } from "./event-members";
import {
  DAV_COLLECTION_PATH,
  DAV_HOME_SET_PATH,
  DAV_PRINCIPAL_PATH,
  DAV_ROOT_PATH,
  SERVER_UID_NAMESPACE,
  ctagOf,
  davWindow,
  etagOf,
  eventToIcs,
  hrefForEvent,
  icsToEventInput,
  resourceNameForEvent,
  resourceNameFromPath,
  serverEventIdFromName,
  type DavEventShape,
} from "./caldav-collection";

export interface CalDavRequest {
  /** HTTP-Methode, wie sie ankommt (nach Proxy-Übersetzung also z. B. POST). */
  method: string;
  /** Ursprüngliche DAV-Methode aus `x-uwe-dav-method`, falls übersetzt. */
  davMethod?: string | null;
  pathname: string;
  depth?: string | null;
  ifMatch?: string | null;
  ifNoneMatch?: string | null;
  body: string;
}

export interface CalDavResponse {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

/** Die schmale Sicht auf den CalendarService, die der Dispatcher braucht. */
export interface CalDavCalendarWriter {
  ensureLocalFeed(): Promise<{ id: string }>;
  createEvent(input: {
    feedId: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: Date;
    endAt?: Date | null;
    allDay?: boolean;
    kind?: "personal";
    externalUid?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<DavEventShape>;
  updateEvent(
    id: string,
    input: {
      title?: string;
      description?: string | null;
      location?: string | null;
      startAt?: Date;
      endAt?: Date | null;
      allDay?: boolean;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<DavEventShape>;
  deleteEvent(id: string): Promise<void>;
}

const DAV_HEADER = "1, calendar-access";
const ALLOW_HEADER = "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT";
const XML_CONTENT_TYPE = "application/xml; charset=utf-8";
const ICS_CONTENT_TYPE = "text/calendar; charset=utf-8";

type DavNode =
  | { kind: "root" }
  | { kind: "principal" }
  | { kind: "home" }
  | { kind: "collection" }
  | { kind: "resource"; name: string };

function normalize(pathname: string): string {
  const clean = pathname.split("?")[0] ?? pathname;
  return clean.endsWith("/") ? clean : `${clean}/`;
}

function resolveNode(pathname: string): DavNode | null {
  const withSlash = normalize(pathname);
  if (withSlash === DAV_ROOT_PATH) return { kind: "root" };
  if (withSlash === DAV_PRINCIPAL_PATH) return { kind: "principal" };
  if (withSlash === DAV_HOME_SET_PATH) return { kind: "home" };
  if (withSlash === DAV_COLLECTION_PATH) return { kind: "collection" };
  const name = resourceNameFromPath(pathname.split("?")[0] ?? pathname);
  if (name) return { kind: "resource", name };
  return null;
}

function quoted(etag: string): string {
  return `"${etag}"`;
}

function unquoted(header: string | null | undefined): string | null {
  if (!header) return null;
  return header.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
}

function xmlResponse(status: number, body: string): CalDavResponse {
  return { status, headers: { "Content-Type": XML_CONTENT_TYPE, DAV: DAV_HEADER }, body };
}

function davError(status: number, message: string): CalDavResponse {
  return xmlResponse(
    status,
    `<?xml version="1.0" encoding="utf-8"?>\n<D:error xmlns:D="DAV:"><D:responsedescription>${escapeXml(message)}</D:responsedescription></D:error>`,
  );
}

const PRINCIPAL_HREF = `<D:href>${DAV_PRINCIPAL_PATH}</D:href>`;

function propsForNode(node: DavNode, ctx: { ctag: string }): Record<string, DavProp> {
  const common: Record<string, DavProp> = {
    "current-user-principal": { tag: "D:current-user-principal", inner: PRINCIPAL_HREF },
    "principal-URL": { tag: "D:principal-URL", inner: PRINCIPAL_HREF },
    owner: { tag: "D:owner", inner: PRINCIPAL_HREF },
  };

  switch (node.kind) {
    case "root":
      return {
        ...common,
        resourcetype: { tag: "D:resourcetype", inner: "<D:collection/>" },
        displayname: { tag: "D:displayname", inner: escapeXml("UWE Family DAV") },
      };
    case "principal":
      return {
        ...common,
        resourcetype: { tag: "D:resourcetype", inner: "<D:principal/>" },
        displayname: { tag: "D:displayname", inner: escapeXml("Familie") },
        "calendar-home-set": {
          tag: "C:calendar-home-set",
          inner: `<D:href>${DAV_HOME_SET_PATH}</D:href>`,
        },
      };
    case "home":
      return {
        ...common,
        resourcetype: { tag: "D:resourcetype", inner: "<D:collection/>" },
        displayname: { tag: "D:displayname", inner: escapeXml("Kalender") },
      };
    case "collection":
      return {
        ...common,
        resourcetype: { tag: "D:resourcetype", inner: "<D:collection/><C:calendar/>" },
        displayname: { tag: "D:displayname", inner: escapeXml("UWE Family") },
        getctag: { tag: "CS:getctag", inner: escapeXml(ctx.ctag) },
        "supported-calendar-component-set": {
          tag: "C:supported-calendar-component-set",
          inner: '<C:comp name="VEVENT"/>',
        },
        "supported-report-set": {
          tag: "D:supported-report-set",
          inner:
            "<D:supported-report><D:report><C:calendar-query/></D:report></D:supported-report>" +
            "<D:supported-report><D:report><C:calendar-multiget/></D:report></D:supported-report>",
        },
        // Ohne explizites Schreibrecht mountet iOS den Kalender read-only.
        "current-user-privilege-set": {
          tag: "D:current-user-privilege-set",
          inner:
            "<D:privilege><D:read/></D:privilege>" +
            "<D:privilege><D:write/></D:privilege>" +
            "<D:privilege><D:write-content/></D:privilege>" +
            "<D:privilege><D:bind/></D:privilege>" +
            "<D:privilege><D:unbind/></D:privilege>",
        },
      };
    case "resource":
      return {};
  }
}

function hrefOfNode(node: DavNode): string {
  switch (node.kind) {
    case "root":
      return DAV_ROOT_PATH;
    case "principal":
      return DAV_PRINCIPAL_PATH;
    case "home":
      return DAV_HOME_SET_PATH;
    case "collection":
      return DAV_COLLECTION_PATH;
    case "resource":
      return `${DAV_COLLECTION_PATH}${node.name}.ics`;
  }
}

function propfindResponseFor(
  node: DavNode,
  requested: string[] | null,
  ctx: { ctag: string },
): MultistatusResponse {
  const available = propsForNode(node, ctx);
  const names = requested ?? Object.keys(available);
  const found: DavProp[] = [];
  const notFound: string[] = [];
  for (const name of names) {
    const prop = available[name];
    if (prop) found.push(prop);
    else notFound.push(name);
  }
  return { href: hrefOfNode(node), found, notFound };
}

function resourceListingResponse(
  event: Pick<DavEventShape, "id" | "externalUid" | "updatedAt">,
): MultistatusResponse {
  return {
    href: hrefForEvent(event),
    found: [
      { tag: "D:getetag", inner: escapeXml(quoted(etagOf(event))) },
      {
        tag: "D:getcontenttype",
        inner: escapeXml("text/calendar; charset=utf-8; component=VEVENT"),
      },
      { tag: "D:resourcetype", inner: "" },
    ],
  };
}

export class FamilyCalDavServer {
  constructor(
    private readonly familyDb: FamilyPrismaClient,
    private readonly calendar: CalDavCalendarWriter,
  ) {}

  private async localFeedId(): Promise<string> {
    const feed = await this.calendar.ensureLocalFeed();
    return feed.id;
  }

  private async listLocalEvents(range?: { from?: Date; to?: Date }) {
    const feedId = await this.localFeedId();
    const window = davWindow();
    const from = range?.from ?? window.from;
    const to = range?.to ?? window.to;
    const events = await this.familyDb.calendarEvent.findMany({
      where: { feedId, startAt: { gte: from, lte: to } },
      orderBy: { startAt: "asc" },
      take: 2000,
    });
    return attachMembersToEvents(this.familyDb, events);
  }

  private async resolveResource(name: string) {
    const feedId = await this.localFeedId();
    const serverId = serverEventIdFromName(name);
    if (serverId) {
      const event = await this.familyDb.calendarEvent.findUnique({ where: { id: serverId } });
      return event && event.feedId === feedId ? event : null;
    }
    return this.familyDb.calendarEvent.findFirst({
      where: { feedId, externalUid: name },
    });
  }

  async handle(request: CalDavRequest): Promise<CalDavResponse> {
    const method = (request.davMethod ?? request.method).toUpperCase();
    const node = resolveNode(request.pathname);
    if (!node) return davError(404, "Nicht gefunden.");

    switch (method) {
      case "OPTIONS":
        return { status: 200, headers: { DAV: DAV_HEADER, Allow: ALLOW_HEADER } };
      case "PROPFIND":
        return this.propfind(node, request);
      case "REPORT":
        return this.report(node, request);
      case "GET":
      case "HEAD":
        return this.get(node, method === "HEAD");
      case "PUT":
        return this.put(node, request);
      case "DELETE":
        return this.delete(node, request);
      default:
        // MKCALENDAR, PROPPATCH, MOVE … — für eine feste Einzel-Collection
        // bewusst nicht unterstützt; iOS kommt ohne aus.
        return davError(403, `Methode ${method} wird nicht unterstützt.`);
    }
  }

  private async propfind(node: DavNode, request: CalDavRequest): Promise<CalDavResponse> {
    const requested = parsePropfindProps(request.body);
    const events = await this.listLocalEvents();
    const ctx = { ctag: ctagOf(events) };
    const depth = (request.depth ?? "0").trim().toLowerCase();

    if (node.kind === "resource") {
      const event = await this.resolveResource(node.name);
      if (!event) return davError(404, "Nicht gefunden.");
      return xmlResponse(207, buildMultistatus([resourceListingResponse(event)]));
    }

    const responses: MultistatusResponse[] = [propfindResponseFor(node, requested, ctx)];
    if (depth !== "0") {
      if (node.kind === "home") {
        responses.push(propfindResponseFor({ kind: "collection" }, requested, ctx));
      } else if (node.kind === "collection") {
        for (const event of events) {
          responses.push(resourceListingResponse(event));
        }
      }
    }
    return xmlResponse(207, buildMultistatus(responses));
  }

  private async report(node: DavNode, request: CalDavRequest): Promise<CalDavResponse> {
    if (node.kind !== "collection" && node.kind !== "resource") {
      return davError(403, "REPORT nur auf dem Kalender.");
    }

    if (/<(?:[A-Za-z0-9_-]+:)?calendar-multiget\b/.test(request.body)) {
      const hrefs = parseMultigetHrefs(request.body);
      const responses: MultistatusResponse[] = [];
      for (const href of hrefs) {
        const name = resourceNameFromPath(href.split("?")[0] ?? href);
        const event = name ? await this.resolveResource(name) : null;
        if (!event) {
          responses.push({ href, status: 404 });
          continue;
        }
        const [withMembers] = await attachMembersToEvents(this.familyDb, [event]);
        responses.push(this.resourceDataResponse(event, withMembers?.members ?? []));
      }
      return xmlResponse(207, buildMultistatus(responses));
    }

    if (/<(?:[A-Za-z0-9_-]+:)?calendar-query\b/.test(request.body)) {
      const range = parseCalendarQueryTimeRange(request.body);
      const window = davWindow();
      const events = await this.listLocalEvents({
        from: range?.start && range.start > window.from ? range.start : window.from,
        to: range?.end && range.end < window.to ? range.end : window.to,
      });
      const wantsData =
        parsePropfindProps(request.body) === null ||
        /<(?:[A-Za-z0-9_-]+:)?calendar-data\b/.test(request.body);
      const responses = events.map((event) =>
        wantsData
          ? this.resourceDataResponse(event, event.members)
          : resourceListingResponse(event),
      );
      return xmlResponse(207, buildMultistatus(responses));
    }

    return davError(403, "Unbekannter REPORT.");
  }

  private resourceDataResponse(
    event: DavEventShape,
    members: readonly { displayName: string }[],
  ): MultistatusResponse {
    const ics = eventToIcs(
      event,
      members.map((member) => member.displayName),
    );
    return {
      href: hrefForEvent(event),
      found: [
        { tag: "D:getetag", inner: escapeXml(quoted(etagOf(event))) },
        { tag: "C:calendar-data", inner: escapeXml(ics) },
      ],
    };
  }

  private async get(node: DavNode, headOnly: boolean): Promise<CalDavResponse> {
    if (node.kind !== "resource") return davError(405, "GET nur auf Einzelterminen.");
    const event = await this.resolveResource(node.name);
    if (!event) return davError(404, "Nicht gefunden.");
    const [withMembers] = await attachMembersToEvents(this.familyDb, [event]);
    const ics = eventToIcs(
      event,
      (withMembers?.members ?? []).map((member) => member.displayName),
    );
    return {
      status: 200,
      headers: {
        "Content-Type": ICS_CONTENT_TYPE,
        ETag: quoted(etagOf(event)),
        DAV: DAV_HEADER,
      },
      ...(headOnly ? {} : { body: ics }),
    };
  }

  private async put(node: DavNode, request: CalDavRequest): Promise<CalDavResponse> {
    if (node.kind !== "resource") return davError(405, "PUT nur auf Einzelterminen.");

    const parsed = icsToEventInput(request.body);
    if (!parsed) return davError(400, "Kein verwertbares VEVENT im Kalender.");

    const existing = await this.resolveResource(node.name);
    const ifMatch = unquoted(request.ifMatch);
    const ifNoneMatch = request.ifNoneMatch?.trim() ?? null;

    if (ifNoneMatch === "*" && existing) return davError(412, "Ressource existiert bereits.");
    if (ifMatch && (!existing || etagOf(existing) !== ifMatch)) {
      return davError(412, "ETag stimmt nicht überein.");
    }

    if (existing) {
      const currentMetadata =
        existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      const updated = await this.calendar.updateEvent(existing.id, {
        title: parsed.title,
        description: parsed.description,
        location: parsed.location,
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        allDay: parsed.allDay,
        metadata: { ...currentMetadata, ...parsed.metadata },
      });
      return {
        status: 204,
        headers: { ETag: quoted(etagOf(updated)), DAV: DAV_HEADER },
      };
    }

    // Neuanlage: der Server-Namensraum ist reserviert — ein Client darf dort
    // bestehende Termine ändern (oben), aber keine neuen anlegen.
    if (node.name.startsWith(SERVER_UID_NAMESPACE)) {
      return davError(403, "Reservierter Namensraum.");
    }

    const feedId = await this.localFeedId();
    const created = await this.calendar.createEvent({
      feedId,
      title: parsed.title,
      description: parsed.description,
      location: parsed.location,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      allDay: parsed.allDay,
      kind: "personal",
      externalUid: node.name,
      metadata: parsed.metadata,
    });
    return {
      status: 201,
      headers: {
        ETag: quoted(etagOf(created)),
        DAV: DAV_HEADER,
        Location: `${DAV_COLLECTION_PATH}${resourceNameForEvent(created)}.ics`,
      },
    };
  }

  private async delete(node: DavNode, request: CalDavRequest): Promise<CalDavResponse> {
    if (node.kind !== "resource") return davError(405, "DELETE nur auf Einzelterminen.");
    const event = await this.resolveResource(node.name);
    if (!event) return davError(404, "Nicht gefunden.");
    const ifMatch = unquoted(request.ifMatch);
    if (ifMatch && etagOf(event) !== ifMatch) {
      return davError(412, "ETag stimmt nicht überein.");
    }
    await this.calendar.deleteEvent(event.id);
    return { status: 204, headers: { DAV: DAV_HEADER } };
  }
}

export function createFamilyCalDavServer(
  familyDb: FamilyPrismaClient,
  calendar: CalDavCalendarWriter,
): FamilyCalDavServer {
  return new FamilyCalDavServer(familyDb, calendar);
}
