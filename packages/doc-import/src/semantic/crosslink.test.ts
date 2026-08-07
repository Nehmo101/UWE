import assert from "node:assert/strict";
import test from "node:test";

import { linkEntityNames } from "./crosslink";

const TARGETS = [{ title: "Der Rauchring" }, { title: "Nepurga" }];

test("verlinkt den ersten Fund im Fließtext", () => {
  assert.equal(
    linkEntityNames("Sie geht durch Der Rauchring und weiter.", TARGETS),
    "Sie geht durch [[Der Rauchring]] und weiter.",
  );
});

test("setzt eine Pipe, wenn die Oberfläche vom Titel abweicht", () => {
  assert.equal(
    linkEntityNames("Sie geht durch Rauchring und weiter.", [{ title: "Der Rauchring", aliases: ["Rauchring"] }]),
    "Sie geht durch [[Der Rauchring|Rauchring]] und weiter.",
  );
});

test("lässt Tabellenzeilen in Ruhe", () => {
  const md = "| Name | Ort |\n|---|---|\n| Gesa Lemm | Der Rauchring |";
  assert.equal(linkEntityNames(md, TARGETS), md);
});

/**
 * Der Grund für diese Datei. Eine Tabelle in einem Blockzitat beginnt mit `>`
 * und fiel deshalb durch die Sperre für Tabellenzeilen hindurch. Der eingefügte
 * Pipe-Link wurde beim Parsen zur Zellengrenze, und die Zeile verlor eine
 * Spalte — ohne Warnung, in einem Handout, das gedruckt werden sollte.
 */
test("lässt Tabellenzeilen auch im Blockzitat in Ruhe", () => {
  const md = "> | Name | Ort |\n> |---|---|\n> | Gesa Lemm | Rauchring |";
  assert.equal(linkEntityNames(md, [{ title: "Der Rauchring", aliases: ["Rauchring"] }]), md);
});

test("das gilt auch für mehrfach und mit Leerraum eingerückte Zitate", () => {
  for (const prefix of [">", "> >", "  >   >  ", ">>"]) {
    const md = `${prefix} | Gesa Lemm | Rauchring |`;
    assert.equal(
      linkEntityNames(md, [{ title: "Der Rauchring", aliases: ["Rauchring"] }]),
      md,
      `Zitatform ${JSON.stringify(prefix)} nicht erkannt`,
    );
  }
});

test("zitierte Überschriften bleiben ebenfalls unverlinkt", () => {
  const md = "> ## Der Rauchring bei Nacht";
  assert.equal(linkEntityNames(md, TARGETS), md);
});

test("zitierter Fließtext wird weiterhin verlinkt", () => {
  // Ein Blockzitat ist in diesen Bänden ein Vorlesetext. Dort sollen Namen
  // klickbar sein — gesperrt sind nur Tabellen, Überschriften und Codezäunen.
  assert.equal(
    linkEntityNames("> Ihr steht in Der Rauchring, und es riecht nach Rauch.", TARGETS),
    "> Ihr steht in [[Der Rauchring]], und es riecht nach Rauch.",
  );
});

test("Codezäune bleiben unangetastet, auch zitiert", () => {
  const md = "> ```\n> Der Rauchring\n> ```";
  assert.equal(linkEntityNames(md, TARGETS), md);
});

test("bleibt auf einer Zeile aus lauter Leerraum und Zitatzeichen schnell", () => {
  // stripQuoteMarkers läuft Zeichen für Zeichen; ein Muster mit zwei Quantoren
  // wäre hier quadratisch.
  const hostile = `${" >".repeat(50_000)} Der Rauchring`;

  const started = process.hrtime.bigint();
  linkEntityNames(hostile, TARGETS);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(elapsedMs < 1000, `linkEntityNames brauchte ${elapsedMs.toFixed(0)} ms`);
});
