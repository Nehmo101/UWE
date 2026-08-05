import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_EVENT_DURATION_MINUTES, resolveEventEnd } from "./event-duration";

describe("Standarddauer eines Termins", () => {
  const start = new Date(Date.UTC(2026, 7, 5, 9, 30));

  it("gibt einem Termin ohne Ende eine Stunde", () => {
    const end = resolveEventEnd(start, null);
    assert.ok(end);
    assert.equal(end.getTime() - start.getTime(), DEFAULT_EVENT_DURATION_MINUTES * 60_000);
  });

  it("behandelt ein fehlendes Ende wie null", () => {
    const end = resolveEventEnd(start, undefined);
    assert.ok(end);
    assert.equal(end.toISOString(), new Date(Date.UTC(2026, 7, 5, 10, 30)).toISOString());
  });

  it("lässt ein angegebenes Ende unangetastet — Nacharbeiten geht immer", () => {
    const own = new Date(Date.UTC(2026, 7, 5, 13, 0));
    assert.equal(resolveEventEnd(start, own), own);
  });

  it("lässt auch ein kürzeres oder gleiches Ende stehen", () => {
    const same = new Date(start.getTime());
    assert.equal(resolveEventEnd(start, same), same);
  });

  it("gibt ganztägigen Terminen kein Ende — der Feed spannt den Tag auf", () => {
    assert.equal(resolveEventEnd(start, null, { allDay: true }), null);
  });

  it("behält das eigene Ende auch bei ganztägig", () => {
    const own = new Date(Date.UTC(2026, 7, 7, 0, 0));
    assert.equal(resolveEventEnd(start, own, { allDay: true }), own);
  });

  it("erfindet aus einem kaputten Start kein Ende", () => {
    assert.equal(resolveEventEnd(new Date("nicht-datum"), null), null);
  });

  it("ignoriert ein kaputtes Ende und rechnet die Stunde", () => {
    const end = resolveEventEnd(start, new Date("nicht-datum"));
    assert.ok(end);
    assert.equal(end.getTime() - start.getTime(), 60 * 60_000);
  });
});
