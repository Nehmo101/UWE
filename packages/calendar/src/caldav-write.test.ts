import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCalDavEventHref, eventToIcalBody } from "./caldav-write";

describe("caldav-write", () => {
  it("builds remote href from uid", () => {
    const href = buildCalDavEventHref("https://caldav.example.com/cal/", "uwe-session-1");
    assert.equal(href, "https://caldav.example.com/cal/uwe-session-1.ics");
  });

  it("generates iCal body for event", () => {
    const body = eventToIcalBody({
      uid: "uwe-session-1",
      title: "Session",
      startAt: new Date("2026-06-20T19:00:00Z"),
    });
    assert.match(body, /BEGIN:VEVENT/);
    assert.match(body, /SUMMARY:Session/);
  });
});
