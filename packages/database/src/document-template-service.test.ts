import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createDocumentTemplateService,
  extractDocumentTemplateVariables,
  fillDocumentTemplate,
  MissingTemplateVariablesError,
  normalizeDocumentTemplateVariables,
} from "./document-template-service";
import { createTestBrainClient, type BrainPrismaClient } from "./test-helpers";

describe("document template helpers", () => {
  it("extracts unique sorted placeholders including whitespace variants", () => {
    const body = "Hallo {{mieter}}, Vertrag mit {{ vermieter }} für {{mieter}}.";
    assert.deepEqual(extractDocumentTemplateVariables(body), ["mieter", "vermieter"]);
    assert.deepEqual(extractDocumentTemplateVariables("kein Platzhalter"), []);
  });

  it("normalizes the variables Json field from array or object", () => {
    assert.deepEqual(normalizeDocumentTemplateVariables(["b", "a", 3]), ["a", "b"]);
    assert.deepEqual(normalizeDocumentTemplateVariables({ x: 1, a: 2 }), ["a", "x"]);
    assert.deepEqual(normalizeDocumentTemplateVariables(null), []);
    assert.deepEqual(normalizeDocumentTemplateVariables("nope"), []);
  });
});

describe("fillDocumentTemplate", () => {
  const template = {
    name: "Mietvertrag",
    body: "Vertrag zwischen {{vermieter}} und {{ mieter }}.\nMiete: {{miete}} EUR",
    variables: ["mieter", "vermieter", "miete"],
  };

  it("substitutes all placeholders and trims values", () => {
    const result = fillDocumentTemplate(
      template,
      { vermieter: " Alice ", mieter: "Bob", miete: "900" },
      { now: new Date("2026-07-02T10:00:00Z") },
    );
    assert.equal(
      result.content,
      "Vertrag zwischen Alice und Bob.\nMiete: 900 EUR",
    );
    assert.ok(!result.content.includes("{{"), "unresolved placeholder left");
    assert.equal(result.title, "Mietvertrag — 2026-07-02");
    assert.deepEqual(result.variables, ["miete", "mieter", "vermieter"]);
  });

  it("uses the explicit title when provided", () => {
    const result = fillDocumentTemplate(template, {
      vermieter: "A",
      mieter: "B",
      miete: "1",
    }, { title: "  Vertrag Musterstraße  " });
    assert.equal(result.title, "Vertrag Musterstraße");
  });

  it("rejects empty or missing required variables with all keys listed", () => {
    assert.throws(
      () => fillDocumentTemplate(template, { vermieter: "A", mieter: "  " }),
      (error: unknown) => {
        assert.ok(error instanceof MissingTemplateVariablesError);
        assert.deepEqual(error.missing, ["miete", "mieter"]);
        assert.match(error.message, /Pflichtfelder fehlen/);
        return true;
      },
    );
  });

  it("requires declared variables even when they are not in the body", () => {
    assert.throws(
      () =>
        fillDocumentTemplate(
          { name: "T", body: "Ohne Platzhalter", variables: ["freigabe"] },
          {},
        ),
      MissingTemplateVariablesError,
    );
  });

  it("passes for templates without placeholders", () => {
    const result = fillDocumentTemplate(
      { name: "Checkliste", body: "1. Prüfen\n2. Abhaken", variables: null },
      {},
      { now: new Date("2026-01-05T00:00:00Z") },
    );
    assert.equal(result.content, "1. Prüfen\n2. Abhaken");
    assert.equal(result.title, "Checkliste — 2026-01-05");
  });
});

describe("document template service", () => {
  let db: BrainPrismaClient;
  let service: ReturnType<typeof createDocumentTemplateService>;

  before(async () => {
    db = createTestBrainClient();
    service = createDocumentTemplateService(db);
  });

  it("generates and stores a document as personal brain document", async () => {
    const template = await service.createTemplate({
      name: "Mietvertrag",
      category: "contract",
      body: "Vermieter: {{vermieter}}\nMieter: {{mieter}}",
      variables: ["vermieter", "mieter"],
    });

    const document = await service.generateDocument(
      template.id,
      { vermieter: "Alice", mieter: "Bob" },
      { now: new Date("2026-07-02T10:00:00Z") },
    );

    assert.equal(document.title, "Mietvertrag — 2026-07-02");
    assert.equal(document.content, "Vermieter: Alice\nMieter: Bob");
    assert.equal(document.category, "contracts_expenses");

    const stored = await db.personalBrainDocument.findUnique({
      where: { id: document.id },
    });
    assert.ok(stored, "generated document not persisted");
    const metadata = stored.metadata as Record<string, unknown>;
    assert.equal(metadata.generatedFromTemplateId, template.id);
    assert.equal(metadata.generatedFromTemplateName, "Mietvertrag");
    assert.equal(metadata.templateCategory, "contract");
    assert.deepEqual(metadata.variables, { vermieter: "Alice", mieter: "Bob" });
  });

  it("rejects generation when required variables are missing", async () => {
    const template = await service.createTemplate({
      name: "Anleitung",
      category: "guide",
      body: "Schritt: {{schritt}}",
      variables: ["schritt"],
    });

    await assert.rejects(
      service.generateDocument(template.id, {}),
      MissingTemplateVariablesError,
    );
  });

  it("rejects generation for unknown templates", async () => {
    await assert.rejects(
      service.generateDocument("does-not-exist", {}),
      /Vorlage nicht gefunden/,
    );
  });
});
