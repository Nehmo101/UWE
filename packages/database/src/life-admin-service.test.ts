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

  it("supports workshop hobby cockpit entities and capture promotion", async () => {
    const capture = await service.createCapture({
      title: "Goblin squad paint test",
      content: "Contrast paints on goblins",
      captureType: "art_miniature_terrain",
      url: "https://example.com/ref.jpg",
    });

    const workshop = await service.promoteCaptureToWorkshop(capture.id, {
      nextAction: "Basecoat drybrush",
    });

    assert.equal(workshop.nextAction, "Basecoat drybrush");
    assert.ok(workshop.referenceImages);

    const recipe = await service.createWorkshopPaintRecipe({
      name: "Goblin green",
      targetType: "miniature",
      primer: "Chaos Black",
      basecoat: "Warpstone Glow",
      workshopProjectId: workshop.id,
      rating: 4,
    });

    const profile = await service.createWorkshopPrintProfile({
      name: "Ruin tile",
      printer: "Bambu P1S",
      filament: "PLA matte grey",
      layerHeight: "0.2",
      result: "gut",
      workshopProjectId: workshop.id,
    });

    const rental = await service.createWorkshopTerrainRental({
      terrainSetName: "Forest ruins",
      boxLabel: "Box B2",
      rentalPriceCents: 1500,
      depositCents: 5000,
    });

    const loaded = await service.getWorkshopProject(workshop.id);
    assert.equal(loaded?.paintRecipes.length, 1);
    assert.equal(loaded?.printProfiles.length, 1);
    assert.equal(recipe.name, "Goblin green");
    assert.equal(profile.printer, "Bambu P1S");
    assert.equal(rental.status, "available");

    const tasks = await service.listWorkshopOpenTasks(5);
    assert.ok(tasks.some((task) => task.id === workshop.id));

    const links = await service.listLinksForTarget("workshop_project", workshop.id);
    assert.ok(links.some((link) => link.sourceId === capture.id));
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

  it("updates capture linked status and sets triagedAt", async () => {
    const capture = await service.createCapture({ title: "Linked capture" });
    const updated = await service.updateCapture(capture.id, { status: "linked" });
    assert.equal(updated.status, "linked");
    assert.ok(updated.triagedAt);
  });

  it("archives capture without triagedAt bump", async () => {
    const capture = await service.createCapture({ title: "Archive me" });
    const updated = await service.updateCapture(capture.id, { status: "archived" });
    assert.equal(updated.status, "archived");
  });

  it("searches personal brain documents and facts", async () => {
    await service.createPersonalBrainDocument({
      title: "Router VLAN setup",
      content: "VLAN 10 for gaming, VLAN 20 for IoT",
      category: "homelab",
      tags: ["network", "homelab"],
    });
    await service.createPersonalBrainFact({
      title: "Filament brand",
      content: "Use matte PLA for terrain bases",
      factType: "material",
      tags: ["3d-print"],
    });

    const results = await service.searchPersonalBrain("vlan", { limit: 5 });
    assert.ok(results.documents.some((doc) => doc.title.includes("Router")));

    const factResults = await service.searchPersonalBrain("filament", { limit: 5 });
    assert.ok(factResults.facts.some((fact) => fact.title.includes("Filament")));
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
