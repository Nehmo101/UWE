import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMultistatusResponses } from "./caldav-sync";

describe("caldav-sync", () => {
  it("parseMultistatusResponses extracts calendar-data and etag", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/cal/event-1.ics</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"abc123"</D:getetag>
        <C:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Test
DTSTART:20260101T100000Z
DTEND:20260101T110000Z
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    const responses = parseMultistatusResponses(xml);
    assert.equal(responses.length, 1);
    assert.equal(responses[0]?.href, "/cal/event-1.ics");
    assert.equal(responses[0]?.etag, "abc123");
    assert.match(responses[0]?.calendarData ?? "", /UID:event-1/);
  });
});
