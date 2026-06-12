import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createWorld } from "./repository";
import { createPrismaClient } from "./client";
import {
  applyAutoFitToContent,
  assessTextFit,
  restoreOriginalText,
} from "./label-fit-service";
import {
  defaultElementsForMode,
  syncContentFromElements,
} from "./label-elements";
import {
  analyzeLabelSafety,
  removeDmOnlyElements,
  stripDmOnlyForPlayer,
} from "./label-safety";
import { createLabelService, normalizeLabel } from "./label-service";
import { createPrintListService } from "./label-print-list-service";
import { renderLabelExportAsync, renderMultiLabelPdfAsync } from "./label-export";

describe("Label editor extensions", () => {
  let databaseUrl: string;
  let labels: ReturnType<typeof createLabelService>;
  let printLists: ReturnType<typeof createPrintListService>;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    labels = createLabelService(databaseUrl);
    printLists = createPrintListService(databaseUrl);
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("generates default visual elements from content", () => {
    const elements = defaultElementsForMode(
      { title: "Test", text: "Inhalt", imageAssetId: "img1" },
      "image_text",
    );

    assert.ok(elements.length >= 3);
    assert.equal(elements[0]?.type, "title");
    assert.ok(elements.some((el) => el.type === "image"));
    assert.ok(elements.some((el) => el.type === "text"));
  });

  it("auto-fit reduces font size without overwriting original text", () => {
    const longText = "Wort ".repeat(200);
    const content = {
      title: "Lang",
      text: longText,
      originalText: longText,
      elements: defaultElementsForMode({ title: "Lang", text: longText }, "text_only"),
    };

    const fitted = applyAutoFitToContent(content, {
      mode: "text_only",
      truncateToPage: true,
      truncateLongWords: true,
      widthInches: 6,
      heightInches: 4,
      fitMode: "normal",
    });

    assert.equal(fitted.originalText, longText);
    assert.ok((fitted.text?.length ?? 0) <= longText.length);
    assert.ok(fitted.fitApplied);
  });

  it("restores original text after auto-fit", () => {
    const original = "Originaltext für das Label.";
    const content = {
      title: "Test",
      text: "Gekürzt…",
      originalText: original,
      fitApplied: true,
      elements: defaultElementsForMode({ title: "Test", text: original }, "text_only"),
    };

    const restored = restoreOriginalText(content);
    assert.equal(restored.text, original);
    assert.equal(restored.fitApplied, false);
  });

  it("assessTextFit reports overflow for very long text", () => {
    const result = assessTextFit("Wort ".repeat(500), {
      mode: "aggressive",
      elementWidthInches: 5,
      elementHeightInches: 1,
      maxChars: 100,
    });

    assert.ok(["tight", "overflow"].includes(result.fitStatus));
  });

  it("strips DM-only content for player export", () => {
    const content = {
      title: "Geheim",
      text: "Spieler-Text",
      containsDmOnly: true,
      dmOnlyBlockCount: 2,
      elements: [
        {
          id: "t1",
          type: "text" as const,
          x: 0.2,
          y: 0.2,
          width: 5,
          height: 1,
          zIndex: 1,
          visible: true,
          text: "Spieler",
        },
        {
          id: "d1",
          type: "text" as const,
          x: 0.2,
          y: 1.5,
          width: 5,
          height: 1,
          zIndex: 2,
          visible: true,
          dmOnly: true,
          text: "DM Geheimnis",
        },
      ],
    };

    const player = stripDmOnlyForPlayer(content);
    assert.equal(player.containsDmOnly, false);
    assert.equal(player.elements?.find((el) => el.id === "d1")?.visible, false);
  });

  it("safety analysis warns about DM-only content", () => {
    const report = analyzeLabelSafety({
      title: "Test",
      text: "Text",
      containsDmOnly: true,
      dmOnlyBlockCount: 1,
    });

    assert.equal(report.canExportPlayer, false);
    assert.ok(report.warnings.some((w) => w.code === "dm_only"));
  });

  it("saves and reopens label with visual elements", async () => {
    const world = await createWorld(
      { name: "Editorwelt", slug: "editorwelt", description: "Test" },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const elements = defaultElementsForMode(
      { title: "Mein Label", text: "Editor-Text" },
      "text_only",
    );

    const created = await labels.createLabel({
      worldId: world.id,
      title: "Editor Label",
      sourceType: "manual",
      templateId: template.id,
      content: syncContentFromElements(
        { title: "Mein Label", text: "Editor-Text", editorMode: "visual" },
        elements,
      ),
    });

    const reopened = await labels.getLabelById(created.id);
    assert.ok(reopened);
    const normalized = normalizeLabel(reopened!);
    assert.ok((normalized.content.elements?.length ?? 0) > 0);
  });

  it("saves, duplicates and deletes world templates", async () => {
    const world = await createWorld(
      { name: "Templatewelt", slug: "templatewelt", description: "Test" },
      databaseUrl,
    );

    const template = await labels.createWorldTemplate({
      worldId: world.id,
      name: "Mein Template",
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        widthInches: 6,
        heightInches: 4,
      },
    });

    const copy = await labels.duplicateTemplate(template.id, world.id);
    assert.match(copy.name, /Kopie/);

    await labels.renameTemplate(copy.id, "Umbenannt");
    await labels.deleteWorldTemplate(copy.id);

    const remaining = await labels.listTemplates(world.id);
    assert.ok(remaining.some((t) => t.id === template.id));
    assert.equal(remaining.filter((t) => t.id === copy.id).length, 0);
  });

  it("creates print list with copies and exports multi-page PDF", async () => {
    const world = await createWorld(
      { name: "Listenwelt", slug: "listenwelt", description: "Test" },
      databaseUrl,
    );

    const template = await labels.getDefaultTemplate();
    const labelA = await labels.createLabel({
      worldId: world.id,
      title: "Label A",
      sourceType: "manual",
      templateId: template.id,
      content: { title: "A", text: "Text A" },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        widthInches: 6,
        heightInches: 4,
      },
    });

    const labelB = await labels.createLabel({
      worldId: world.id,
      title: "Label B",
      sourceType: "manual",
      templateId: template.id,
      content: { title: "B", text: "Text B" },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        widthInches: 6,
        heightInches: 4,
      },
    });

    const list = await printLists.create({
      worldId: world.id,
      name: "Session Handouts",
      labelIds: [
        { labelId: labelA.id, copies: 2 },
        { labelId: labelB.id, copies: 1 },
      ],
    });

    assert.equal(list.items.length, 2);
    const expanded = printLists.expandItemsForExport(list);
    assert.equal(expanded.length, 3);

    const pdf = await renderMultiLabelPdfAsync(
      expanded.map((label) => ({
        content: { title: label.title, text: (label.content as { text: string }).text },
        layoutSettings: {
          mode: "text_only",
          truncateToPage: true,
          truncateLongWords: true,
          widthInches: 6,
          heightInches: 4,
        },
        title: label.title,
      })),
    );

    assert.match(String(pdf).slice(0, 8), /%PDF/);
  });

  it("async PDF export works for text labels", async () => {
    const result = await renderLabelExportAsync("pdf", {
      content: { title: "PDF Test", text: "Exportierbarer Text." },
      layoutSettings: {
        mode: "text_only",
        truncateToPage: true,
        truncateLongWords: true,
        widthInches: 6,
        heightInches: 4,
      },
      title: "PDF Test",
    });

    assert.equal(result.contentType, "application/pdf");
    assert.match(String(result.body).slice(0, 8), /%PDF/);
  });

  it("player label does not receive DM-only elements after strip", () => {
    const content = removeDmOnlyElements({
      title: "Test",
      text: "Spieler",
      containsDmOnly: true,
      elements: [
        {
          id: "dm",
          type: "text",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          zIndex: 1,
          visible: true,
          dmOnly: true,
          text: "secret",
        },
      ],
    });

    assert.equal(content.containsDmOnly, false);
    assert.equal(content.elements?.length, 0);
  });
});
