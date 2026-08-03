import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAppPath } from "./runtime-env-parse";

describe("normalizeAppPath", () => {
  it("adds the leading slash and drops trailing ones", () => {
    assert.equal(normalizeAppPath("studio", "/studio"), "/studio");
    assert.equal(normalizeAppPath("/studio/", "/studio"), "/studio");
    assert.equal(normalizeAppPath("/studio///", "/studio"), "/studio");
  });

  it("falls back when the value is empty or collapses to nothing", () => {
    assert.equal(normalizeAppPath(undefined, "/studio"), "/studio");
    assert.equal(normalizeAppPath("   ", "/studio"), "/studio");
    // "///" wird zu "" — dann gilt der Vorgabewert, nicht der leere Pfad.
    assert.equal(normalizeAppPath("///", "/studio"), "/studio");
  });

  it("keeps the root only where it is allowed", () => {
    assert.equal(normalizeAppPath("/", "/portal", { allowRoot: true }), "/");
    assert.equal(normalizeAppPath("/", "/portal"), "/portal");
  });

  it("stays linear on a long run of slashes", () => {
    // Regressionsschutz für CodeQL `js/polynomial-redos`. Der teure Fall ist
    // *nicht* die Kette am Ende (die kürzt V8 ab), sondern eine lange Kette,
    // auf die noch ein Zeichen folgt: `replace(/\/+$/, "")` setzt dann an jeder
    // Position neu an. Mit 60 000 Schrägstrichen sind das über 1,5 Sekunden,
    // die Schleife braucht Mikrosekunden.
    const pathological = `${"/".repeat(60_000)}x`;
    const startedAt = process.hrtime.bigint();
    const result = normalizeAppPath(pathological, "/studio");
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    assert.equal(result.length, pathological.length);
    assert.ok(result.endsWith("x"));
    assert.ok(elapsedMs < 300, `normalizeAppPath brauchte ${elapsedMs.toFixed(1)} ms`);
  });
});
