import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPageMarker,
  joinOcrPages,
  normalizeOcrMarkdown,
  readPageNumbers,
  stripDetectionMarkers,
  stripPageMarkers,
} from "./markers";

test("entfernt die DeepSeek-Schreibweise und behält den Typ aus dem ref-Block", () => {
  const raw = "# Die Taverne\n<|ref|>figure<|/ref|><|det|>[[12, 40, 380, 520]]<|/det|>\nText danach.";
  const result = stripDetectionMarkers(raw, 3);

  assert.equal(result.markdown, "# Die Taverne\n\nText danach.");
  assert.deepEqual(result.regions, [
    { type: "figure", box: { x1: 12, y1: 40, x2: 380, y2: 520 }, pageNumber: 3 },
  ]);
});

test("entfernt die kompakte Schreibweise mit Label im det-Block", () => {
  const result = stripDetectionMarkers("<|det|>table [10, 20, 300, 400]<|/det|>Inhalt");

  assert.equal(result.markdown, "Inhalt");
  assert.deepEqual(result.regions, [
    { type: "table", box: { x1: 10, y1: 20, x2: 300, y2: 400 }, pageNumber: 1 },
  ]);
});

test("liest mehrere Boxen aus einem Marker", () => {
  const result = stripDetectionMarkers("<|det|>figure [1, 2, 3, 4], [5, 6, 7, 8]<|/det|>");

  assert.equal(result.regions.length, 2);
  assert.deepEqual(result.regions[1]?.box, { x1: 5, y1: 6, x2: 7, y2: 8 });
});

test("verwirft entartete Boxen ohne Fläche", () => {
  const result = stripDetectionMarkers("<|det|>figure [10, 20, 10, 400]<|/det|>Text");

  assert.deepEqual(result.regions, []);
  assert.equal(result.markdown, "Text");
});

test("unbekannte Marker verschwinden, statt den Lauf zu kippen", () => {
  const result = stripDetectionMarkers("A<|det|>voellig anderes format<|/det|>B");

  assert.equal(result.markdown, "AB");
  assert.deepEqual(result.regions, []);
});

test("Markdown ohne Marker bleibt unverändert", () => {
  const raw = "# Kapitel\n\nEin Absatz.";
  assert.equal(stripDetectionMarkers(raw).markdown, raw);
});

test("normalizeOcrMarkdown vereinheitlicht Zeilenenden und Leerzeilen", () => {
  assert.equal(normalizeOcrMarkdown("a  \r\n\r\n\r\n\r\nb\r\n"), "a\n\nb");
});

test("joinOcrPages sortiert nach Seitenzahl und lässt Leerseiten weg", () => {
  const joined = joinOcrPages([
    { pageNumber: 2, markdown: "zweite" },
    { pageNumber: 3, markdown: "   " },
    { pageNumber: 1, markdown: "erste" },
  ]);

  assert.equal(joined, "erste\n\nzweite");
});

test("Seiten-Marker überstehen das Zusammenfügen und lassen sich auslesen", () => {
  const joined = joinOcrPages(
    [
      { pageNumber: 7, markdown: "# Kapitel" },
      { pageNumber: 8, markdown: "Fortsetzung" },
    ],
    { pageMarkers: true },
  );

  assert.deepEqual(readPageNumbers(joined), [7, 8]);
  assert.ok(joined.includes("# Kapitel"));
});

test("ohne die Option bleibt das Markdown markerfrei", () => {
  const joined = joinOcrPages([{ pageNumber: 3, markdown: "Text" }]);

  assert.deepEqual(readPageNumbers(joined), []);
  assert.equal(joined, "Text");
});

test("stripPageMarkers entfernt die Marker restlos", () => {
  const withMarkers = joinOcrPages(
    [
      { pageNumber: 1, markdown: "Erste Seite" },
      { pageNumber: 2, markdown: "Zweite Seite" },
    ],
    { pageMarkers: true },
  );
  const stripped = stripPageMarkers(withMarkers);

  assert.equal(stripped, "Erste Seite\n\nZweite Seite");
  assert.deepEqual(readPageNumbers(stripped), []);
});

test("readPageNumbers liefert sortierte Seiten ohne Dubletten", () => {
  const text = `${buildPageMarker(9)} a ${buildPageMarker(2)} b ${buildPageMarker(9)}`;

  assert.deepEqual(readPageNumbers(text), [2, 9]);
});
