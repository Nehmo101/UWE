import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  createDocumentTemplateService,
  extractDocumentTemplateVariables,
  normalizeDocumentTemplateVariables,
} from "./document-template-service";
import { createTestFamilyClient, type FamilyPrismaClient } from "./test-helpers";

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

describe("document template service", () => {
  let db: FamilyPrismaClient;
  let service: ReturnType<typeof createDocumentTemplateService>;

  before(async () => {
    db = createTestFamilyClient();
    service = createDocumentTemplateService(db);
  });

  it("legt eine Vorlage an, liest sie zurück und löscht sie wieder", async () => {
    const template = await service.createTemplate({
      name: "Mietvertrag",
      category: "contract",
      body: "Vermieter: {{vermieter}}\nMieter: {{mieter}}",
      variables: ["vermieter", "mieter"],
    });

    assert.equal(template.category, "contract");
    assert.deepEqual(await service.getTemplate(template.id).then((t) => t?.name), "Mietvertrag");
    assert.ok((await service.listTemplates()).some((entry) => entry.id === template.id));

    await service.deleteTemplate(template.id);
    assert.equal(await service.getTemplate(template.id), null);
  });

  it("füllt Platzhalter für die Vorschau, ohne Pflichtfeld-Prüfung", async () => {
    // Die Prüfung liegt bewusst in der Oberfläche: das Ergebnis wird kopiert,
    // nicht gespeichert — ein halb gefüllter Text ist deshalb kein Fehler.
    assert.equal(
      service.renderTemplate("Hallo {{name}}, {{gruss}}", { name: "Bob" }),
      "Hallo Bob, ",
    );
  });
});
