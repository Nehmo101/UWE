import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("life admin service", () => {
  let db: PrismaClient;
  let service: ReturnType<typeof createLifeAdminService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    service = createLifeAdminService(db);
  });

  it("creates and lists capture entries", async () => {
    const capture = await service.createCapture({
      title: "Test Capture",
      content: "Something to remember",
      captureType: "quick_note",
    });

    assert.equal(capture.status, "inbox");
    const list = await service.listCaptures({ status: "inbox" });
    assert.ok(list.some((entry) => entry.id === capture.id));
  });

  it("updates capture status and sets triagedAt", async () => {
    const capture = await service.createCapture({ title: "Triaged" });
    const updated = await service.updateCapture(capture.id, { status: "triaged" });
    assert.equal(updated.status, "triaged");
    assert.ok(updated.triagedAt);
  });

  it("creates personal projects and workshop projects", async () => {
    const project = await service.createPersonalProject({
      name: "UWE Admin OS",
      category: "uwe",
      status: "active",
      nextAction: "Today dashboard",
    });

    const workshop = await service.createWorkshopProject({
      title: "Forest terrain tile",
      projectType: "dnd_terrain",
      status: "in_progress",
      materialsNeeded: [{ name: "XPS foam", quantity: "2 sheets" }],
    });

    assert.equal(project.status, "active");
    assert.equal(workshop.projectType, "dnd_terrain");
  });

  it("creates contract and hardware records without bank data", async () => {
    const contract = await service.createContractExpense({
      name: "Cloudflare Pro",
      expenseType: "subscription",
      amountCents: 2000,
      billingDay: 1,
    });

    const device = await service.createHardwareDevice({
      name: "RTX Agent PC",
      role: "local-ai",
      status: "active",
      ipAddress: "192.168.1.50",
    });

    assert.equal(contract.currency, "EUR");
    assert.equal(device.status, "active");
    assert.ok(!JSON.stringify(contract).includes("iban"));
  });

  it("creates personal brain entries", async () => {
    const doc = await service.createPersonalBrainDocument({
      title: "Homelab notes",
      content: "Router config backup location",
      category: "homelab",
    });

    const fact = await service.createPersonalBrainFact({
      title: "Preferred filament",
      content: "PLA matte black for terrain bases",
      factType: "material",
    });

    assert.equal(doc.category, "homelab");
    assert.equal(fact.factType, "material");
  });

  it("links admin entities", async () => {
    const capture = await service.createCapture({ title: "Link test" });
    const project = await service.createPersonalProject({ name: "Linked project" });

    const link = await service.createAdminLink({
      sourceType: "capture",
      sourceId: capture.id,
      targetType: "personal_project",
      targetId: project.id,
      relationType: "promoted_to",
    });

    const links = await service.listLinksForSource("capture", capture.id);
    assert.ok(links.some((entry) => entry.id === link.id));
  });

  it("stores generator presets and output history", async () => {
    const preset = await service.createGeneratorPreset({
      name: "NPC Quick",
      targetType: "npc",
      template: { fields: ["name", "motivation"] },
    });

    const output = await service.createGeneratorOutput({
      presetId: preset.id,
      contextType: "page",
      contextId: "page-test-id",
      generatorAction: "fill_missing_motivation",
      output: { motivation: "Revenge for lost village" },
    });

    const history = await service.listGeneratorOutputs({
      contextType: "page",
      contextId: "page-test-id",
    });

    assert.ok(history.some((entry) => entry.id === output.id));
  });

  it("builds today summary aggregates", async () => {
    await service.createCapture({ title: "Inbox item", status: "inbox" });
    await service.createPersonalProject({ name: "Active", status: "active" });
    await service.createHardwareDevice({ name: "Broken NAS", status: "broken" });

    const summary = await service.getTodaySummary();
    assert.ok(summary.inboxCaptureCount >= 1);
    assert.ok(summary.activeProjectCount >= 1);
    assert.ok(summary.hardwareIssues >= 1);
    assert.ok(Array.isArray(summary.recentCaptures));
  });

  it("deletes capture and related links", async () => {
    const capture = await service.createCapture({ title: "Delete me" });
    const project = await service.createPersonalProject({ name: "Target" });
    await service.createAdminLink({
      sourceType: "capture",
      sourceId: capture.id,
      targetType: "personal_project",
      targetId: project.id,
    });

    await service.deleteCapture(capture.id);
    const links = await service.listLinksForSource("capture", capture.id);
    assert.equal(links.length, 0);
    assert.equal(await service.getCapture(capture.id), null);
  });
});
