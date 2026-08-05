import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "@uwe/database/client";
import { createCalendarService } from "@uwe/database/calendar-service";
import {
  createTestDatabaseUrl,
  createTestFamilyClient,
  type FamilyPrismaClient,
} from "@uwe/database/test-helpers";
import {
  DAV_COLLECTION_PATH,
  DAV_HOME_SET_PATH,
  DAV_PRINCIPAL_PATH,
  DAV_ROOT_PATH,
} from "./caldav-collection";
import { createFamilyCalDavServer, type FamilyCalDavServer } from "./caldav-server";

function davRequest(overrides: {
  method?: string;
  davMethod?: string | null;
  pathname: string;
  depth?: string | null;
  ifMatch?: string | null;
  ifNoneMatch?: string | null;
  body?: string;
}) {
  return {
    method: overrides.method ?? "POST",
    davMethod: overrides.davMethod ?? null,
    pathname: overrides.pathname,
    depth: overrides.depth ?? null,
    ifMatch: overrides.ifMatch ?? null,
    ifNoneMatch: overrides.ifNoneMatch ?? null,
    body: overrides.body ?? "",
  };
}

const IOS_PUT_BODY = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Apple Inc.//iOS 19.0//EN",
  "BEGIN:VEVENT",
  "UID:ios-put-1",
  "SUMMARY:Elternabend",
  "LOCATION:Schule",
  "DTSTART;TZID=Europe/Berlin:20260810T190000",
  "DTEND;TZID=Europe/Berlin:20260810T203000",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("FamilyCalDavServer", () => {
  let db: PrismaClient;
  let familyDb: FamilyPrismaClient;
  let server: FamilyCalDavServer;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
    familyDb = createTestFamilyClient();
    const calendar = createCalendarService(familyDb, db);
    server = createFamilyCalDavServer(familyDb, calendar);
  });

  it("beantwortet OPTIONS mit DAV- und Allow-Headern", async () => {
    const response = await server.handle(
      davRequest({ method: "OPTIONS", pathname: DAV_ROOT_PATH }),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.DAV ?? "", /calendar-access/);
    assert.match(response.headers.Allow ?? "", /PROPFIND/);
  });

  it("führt die Discovery-Kette: Root → Principal → Home → Collection", async () => {
    const root = await server.handle(
      davRequest({
        davMethod: "PROPFIND",
        pathname: DAV_ROOT_PATH,
        depth: "0",
        body: '<D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>',
      }),
    );
    assert.equal(root.status, 207);
    assert.match(root.body ?? "", new RegExp(DAV_PRINCIPAL_PATH.replace(/\//g, "\\/")));

    const principal = await server.handle(
      davRequest({
        davMethod: "PROPFIND",
        pathname: DAV_PRINCIPAL_PATH,
        depth: "0",
        body:
          '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
          "<D:prop><C:calendar-home-set/><D:resourcetype/></D:prop></D:propfind>",
      }),
    );
    assert.match(principal.body ?? "", /calendar-home-set/);
    assert.match(principal.body ?? "", new RegExp(DAV_HOME_SET_PATH.replace(/\//g, "\\/")));

    const home = await server.handle(
      davRequest({ davMethod: "PROPFIND", pathname: DAV_HOME_SET_PATH, depth: "1" }),
    );
    assert.equal(home.status, 207);
    // Depth 1 auf dem Home-Set listet die Kalender-Collection samt Rechten.
    assert.match(home.body ?? "", /<C:calendar\/>/);
    assert.match(home.body ?? "", /getctag/);
    assert.match(home.body ?? "", /current-user-privilege-set/);
    assert.match(home.body ?? "", /<D:write\/>/);
  });

  it("echot unbekannte Props als 404-propstat", async () => {
    const response = await server.handle(
      davRequest({
        davMethod: "PROPFIND",
        pathname: DAV_COLLECTION_PATH,
        depth: "0",
        body:
          '<D:propfind xmlns:D="DAV:" xmlns:A="http://apple.com/ns/ical/">' +
          "<D:prop><D:displayname/><A:calendar-color/></D:prop></D:propfind>",
      }),
    );
    assert.match(response.body ?? "", /<D:displayname>UWE Family<\/D:displayname>/);
    assert.match(response.body ?? "", /<D:calendar-color\/>[\s\S]*?404 Not Found/);
  });

  it("PUT legt einen Termin an, GET liefert ihn zurück, ctag ändert sich", async () => {
    const before = await server.handle(
      davRequest({ davMethod: "PROPFIND", pathname: DAV_COLLECTION_PATH, depth: "0" }),
    );
    const ctagBefore = before.body?.match(/<CS:getctag>([^<]+)</)?.[1];

    const put = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics`,
        ifNoneMatch: "*",
        body: IOS_PUT_BODY,
      }),
    );
    assert.equal(put.status, 201);
    assert.ok(put.headers.ETag);

    const stored = await familyDb.calendarEvent.findFirst({
      where: { externalUid: "ios-put-1" },
      include: { feed: true },
    });
    assert.equal(stored?.title, "Elternabend");
    assert.equal(stored?.feed?.type, "local");
    // Sommerzeit: 19:00 Berlin = 17:00 UTC
    assert.equal(stored?.startAt.toISOString(), "2026-08-10T17:00:00.000Z");

    const get = await server.handle(
      davRequest({ method: "GET", pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics` }),
    );
    assert.equal(get.status, 200);
    // Frisches Roh-ICS wird verbatim zurückgegeben (Round-Trip).
    assert.equal(get.body, IOS_PUT_BODY);
    assert.equal(get.headers.ETag, put.headers.ETag);

    const after = await server.handle(
      davRequest({ davMethod: "PROPFIND", pathname: DAV_COLLECTION_PATH, depth: "0" }),
    );
    const ctagAfter = after.body?.match(/<CS:getctag>([^<]+)</)?.[1];
    assert.ok(ctagBefore && ctagAfter);
    assert.notEqual(ctagBefore, ctagAfter);
  });

  it("Konditional-Semantik: If-None-Match auf Bestehendes und stale If-Match geben 412", async () => {
    const duplicate = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics`,
        ifNoneMatch: "*",
        body: IOS_PUT_BODY,
      }),
    );
    assert.equal(duplicate.status, 412);

    const stale = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics`,
        ifMatch: '"12345"',
        body: IOS_PUT_BODY,
      }),
    );
    assert.equal(stale.status, 412);
  });

  it("PUT aktualisiert mit passendem If-Match und bumpt den ETag", async () => {
    const current = await server.handle(
      davRequest({ method: "GET", pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics` }),
    );
    const updatedBody = IOS_PUT_BODY.replace("SUMMARY:Elternabend", "SUMMARY:Elternabend (neu)");
    const put = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics`,
        ifMatch: current.headers.ETag,
        body: updatedBody,
      }),
    );
    assert.equal(put.status, 204);
    assert.notEqual(put.headers.ETag, current.headers.ETag);

    const stored = await familyDb.calendarEvent.findFirst({ where: { externalUid: "ios-put-1" } });
    assert.equal(stored?.title, "Elternabend (neu)");
  });

  it("REPORT calendar-query und calendar-multiget liefern getetag + calendar-data", async () => {
    const query = await server.handle(
      davRequest({
        davMethod: "REPORT",
        pathname: DAV_COLLECTION_PATH,
        body:
          '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
          "<D:prop><D:getetag/><C:calendar-data/></D:prop>" +
          '<C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">' +
          '<C:time-range start="20260801T000000Z" end="20260901T000000Z"/>' +
          "</C:comp-filter></C:comp-filter></C:filter></C:calendar-query>",
      }),
    );
    assert.equal(query.status, 207);
    assert.match(query.body ?? "", /ios-put-1\.ics/);
    assert.match(query.body ?? "", /calendar-data/);

    const multiget = await server.handle(
      davRequest({
        davMethod: "REPORT",
        pathname: DAV_COLLECTION_PATH,
        body:
          '<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
          "<D:prop><D:getetag/><C:calendar-data/></D:prop>" +
          `<D:href>${DAV_COLLECTION_PATH}ios-put-1.ics</D:href>` +
          `<D:href>${DAV_COLLECTION_PATH}gibt-es-nicht.ics</D:href>` +
          "</C:calendar-multiget>",
      }),
    );
    assert.equal(multiget.status, 207);
    assert.match(multiget.body ?? "", /Elternabend/);
    assert.match(multiget.body ?? "", /gibt-es-nicht\.ics[\s\S]*?404 Not Found/);
  });

  it("verweigert Neuanlagen im Server-Namensraum, erlaubt aber Updates dort", async () => {
    const forbidden = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}uwe-family-event-erfunden.ics`,
        body: IOS_PUT_BODY,
      }),
    );
    assert.equal(forbidden.status, 403);

    // Server-seitig angelegter Termin lässt sich vom iPhone aus ändern.
    const calendar = createCalendarService(familyDb, db);
    const local = await calendar.ensureLocalFeed();
    const event = await calendar.createEvent({
      feedId: local.id,
      title: "UWE-Termin",
      startAt: new Date("2026-08-12T10:00:00Z"),
    });
    const update = await server.handle(
      davRequest({
        method: "PUT",
        pathname: `${DAV_COLLECTION_PATH}uwe-family-event-${event.id}.ics`,
        body: IOS_PUT_BODY.replace("SUMMARY:Elternabend", "SUMMARY:Vom iPhone geändert"),
      }),
    );
    assert.equal(update.status, 204);
    const stored = await familyDb.calendarEvent.findUnique({ where: { id: event.id } });
    assert.equal(stored?.title, "Vom iPhone geändert");
  });

  it("Termine fremder Feeds sind keine DAV-Ressourcen", async () => {
    const foreignFeed = await familyDb.calendarFeed.create({
      data: { name: "Schule", type: "ical_url", url: "https://example.test/schule.ics" },
    });
    const foreign = await familyDb.calendarEvent.create({
      data: {
        feedId: foreignFeed.id,
        title: "Schulfest",
        startAt: new Date("2026-08-15T10:00:00Z"),
        kind: "external",
        externalUid: "schule-1",
      },
    });

    const get = await server.handle(
      davRequest({
        method: "GET",
        pathname: `${DAV_COLLECTION_PATH}uwe-family-event-${foreign.id}.ics`,
      }),
    );
    assert.equal(get.status, 404);

    const byUid = await server.handle(
      davRequest({ method: "GET", pathname: `${DAV_COLLECTION_PATH}schule-1.ics` }),
    );
    assert.equal(byUid.status, 404);
  });

  it("DELETE entfernt den Termin; erneutes DELETE gibt 404", async () => {
    const del = await server.handle(
      davRequest({ method: "DELETE", pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics` }),
    );
    assert.equal(del.status, 204);
    assert.equal(await familyDb.calendarEvent.findFirst({ where: { externalUid: "ios-put-1" } }), null);

    const again = await server.handle(
      davRequest({ method: "DELETE", pathname: `${DAV_COLLECTION_PATH}ios-put-1.ics` }),
    );
    assert.equal(again.status, 404);
  });

  it("unbekannte Pfade und Methoden werden abgewiesen", async () => {
    const unknown = await server.handle(
      davRequest({ method: "GET", pathname: "/api/dav/anderswo/x.ics" }),
    );
    assert.equal(unknown.status, 404);

    const mkcalendar = await server.handle(
      davRequest({ davMethod: "MKCALENDAR", pathname: `${DAV_COLLECTION_PATH}neu/` }),
    );
    assert.equal(mkcalendar.status, 404);

    const proppatch = await server.handle(
      davRequest({ davMethod: "PROPPATCH", pathname: DAV_COLLECTION_PATH }),
    );
    assert.equal(proppatch.status, 403);
  });
});
