import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createWorld } from "./repository";
import {
  createLabelService,
  normalizeLabel,
} from "./label-service";
import { renderLabelExport, renderLabelExportAsync } from "./label-export";
import { createPrismaClient } from "./client";

describe("Label service", () => {
  let databaseUrl: string;
  let labels: ReturnType<typeof createLabelService>;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    labels = createLabelService(databaseUrl);
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });



  it("saves and reopens a label draft", async () => {
    const world = await createWorld(
      { name: "Speicherwelt", slug: "speicherwelt", description: "Test" },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const created = await labels.createLabel({
      worldId: world.id,
      title: "Mein Entwurf",
      sourceType: "manual",
      templateId: template.id,
      content: {
        title: "Mein Entwurf",
        text: "Erster Entwurfstext.",
      },
    });

    const reopened = await labels.getLabelById(created.id);
    assert.ok(reopened);
    assert.equal(reopened.title, "Mein Entwurf");

    const updated = await labels.updateLabel(created.id, {
      content: {
        title: "Mein Entwurf",
        text: "Aktualisierter Text.",
      },
    });

    const parsed = normalizeLabel(updated);
    assert.match(parsed.content.text, /Aktualisierter Text/);
  });

  it("exports printable HTML and PDF", async () => {
    const template = await labels.getDefaultTemplate();
    const world = await createWorld(
      { name: "Exportwelt", slug: "exportwelt", description: "Test" },
      databaseUrl,
    );

    const label = await labels.createLabel({
      worldId: world.id,
      title: "Export Test",
      sourceType: "manual",
      templateId: template.id,
      content: {
        title: "Export Test",
        text: "Druckbarer Inhalt für das Label.",
      },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        maxChars: 500,
        maxWordLength: 20,
        widthInches: 6,
        heightInches: 4,
      },
    });

    const parsed = normalizeLabel(label);
    const htmlExport = renderLabelExport("html", {
      content: parsed.content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
      worldName: "Exportwelt",
    });

    assert.equal(htmlExport.contentType, "text/html; charset=utf-8");
    assert.match(String(htmlExport.body), /Druckbarer Inhalt/);
    assert.match(String(htmlExport.body), /6in 4in/);

    const pdfExport = await renderLabelExportAsync("pdf", {
      content: parsed.content,
      layoutSettings: parsed.layoutSettings,
      title: label.title,
    });

    assert.equal(pdfExport.contentType, "application/pdf");
    assert.match(String(pdfExport.body).slice(0, 4), /%PDF/);
  });


});
