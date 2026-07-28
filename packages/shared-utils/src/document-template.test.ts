import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTemplateVariables,
  normalizeTemplateVariables,
  renderDocumentTemplate,
} from "./document-template";

describe("extractTemplateVariables", () => {
  it("findet Platzhalter eindeutig, sortiert und mit Leerraum-Varianten", () => {
    const body = "Hallo {{mieter}}, Vertrag mit {{ vermieter }} für {{mieter}}.";
    assert.deepEqual(extractTemplateVariables(body), ["mieter", "vermieter"]);
  });

  it("gibt eine leere Liste ohne Platzhalter zurück", () => {
    assert.deepEqual(extractTemplateVariables("kein Platzhalter"), []);
  });
});

describe("renderDocumentTemplate", () => {
  it("setzt bekannte Werte ein und lässt fehlende leer", () => {
    assert.equal(
      renderDocumentTemplate("{{a}} und {{ b }}", { a: "eins" }),
      "eins und ",
    );
  });
});

describe("normalizeTemplateVariables", () => {
  it("nimmt Listen unverändert, Objekte als sortierte Schlüssel", () => {
    assert.deepEqual(normalizeTemplateVariables(["b", "a", 3]), ["b", "a"]);
    assert.deepEqual(normalizeTemplateVariables({ x: 1, a: 2 }), ["a", "x"]);
  });

  it("verträgt null und Unsinn", () => {
    assert.deepEqual(normalizeTemplateVariables(null), []);
    assert.deepEqual(normalizeTemplateVariables("nope"), []);
  });
});
