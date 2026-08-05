import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMultistatus,
  escapeXml,
  parseCalendarQueryTimeRange,
  parseMultigetHrefs,
  parsePropfindProps,
} from "./dav-xml";

describe("buildMultistatus", () => {
  it("baut 200- und 404-propstat-Blöcke", () => {
    const xml = buildMultistatus([
      {
        href: "/api/dav/cal/familie/",
        found: [
          { tag: "D:displayname", inner: escapeXml("UWE Family") },
          { tag: "D:resourcetype", inner: "<D:collection/><C:calendar/>" },
        ],
        notFound: ["calendar-color"],
      },
    ]);
    assert.match(xml, /<D:multistatus[^>]*xmlns:C="urn:ietf:params:xml:ns:caldav"/);
    assert.match(xml, /<D:href>\/api\/dav\/cal\/familie\/<\/D:href>/);
    assert.match(xml, /<D:displayname>UWE Family<\/D:displayname>/);
    assert.match(xml, /<D:resourcetype><D:collection\/><C:calendar\/><\/D:resourcetype>/);
    assert.match(xml, /<D:calendar-color\/>[\s\S]*404 Not Found/);
  });

  it("escaped Sonderzeichen in href und Werten", () => {
    const xml = buildMultistatus([
      {
        href: "/api/dav/cal/familie/a&b.ics",
        found: [{ tag: "D:displayname", inner: escapeXml('Kaffee & <Kuchen> "früh"') }],
      },
    ]);
    assert.match(xml, /a&amp;b\.ics/);
    assert.match(xml, /Kaffee &amp; &lt;Kuchen&gt; &quot;früh&quot;/);
    assert.doesNotMatch(xml, /<Kuchen>/);
  });

  it("gibt Gesamt-Status-Responses ohne propstat aus", () => {
    const xml = buildMultistatus([{ href: "/api/dav/cal/familie/fehlt.ics", status: 404 }]);
    assert.match(xml, /<D:status>HTTP\/1\.1 404 Not Found<\/D:status>/);
    assert.doesNotMatch(xml, /propstat/);
  });
});

describe("parsePropfindProps", () => {
  it("liest lokale Property-Namen aus einem PROPFIND-Body", () => {
    const body = `<?xml version="1.0"?>
      <A:propfind xmlns:A="DAV:" xmlns:B="urn:ietf:params:xml:ns:caldav">
        <A:prop>
          <A:current-user-principal/>
          <B:calendar-home-set/>
          <A:resourcetype/>
        </A:prop>
      </A:propfind>`;
    assert.deepEqual(parsePropfindProps(body), [
      "current-user-principal",
      "calendar-home-set",
      "resourcetype",
    ]);
  });

  it("liefert null für allprop und leere Bodies", () => {
    assert.equal(parsePropfindProps(""), null);
    assert.equal(parsePropfindProps('<D:propfind xmlns:D="DAV:"><D:allprop/></D:propfind>'), null);
  });
});

describe("parseMultigetHrefs", () => {
  it("liest alle hrefs und entschärft Entities", () => {
    const body = `<C:calendar-multiget xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:prop><D:getetag/><C:calendar-data/></D:prop>
      <D:href>/api/dav/cal/familie/a.ics</D:href>
      <D:href>/api/dav/cal/familie/b&amp;c.ics</D:href>
    </C:calendar-multiget>`;
    assert.deepEqual(parseMultigetHrefs(body), [
      "/api/dav/cal/familie/a.ics",
      "/api/dav/cal/familie/b&c.ics",
    ]);
  });
});

describe("parseCalendarQueryTimeRange", () => {
  it("liest start und end", () => {
    const body = `<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav">
      <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">
        <C:time-range start="20260701T000000Z" end="20260801T000000Z"/>
      </C:comp-filter></C:comp-filter></C:filter>
    </C:calendar-query>`;
    const range = parseCalendarQueryTimeRange(body);
    assert.equal(range?.start?.toISOString(), "2026-07-01T00:00:00.000Z");
    assert.equal(range?.end?.toISOString(), "2026-08-01T00:00:00.000Z");
  });

  it("liefert null ohne time-range", () => {
    assert.equal(parseCalendarQueryTimeRange("<C:calendar-query/>"), null);
  });
});
