import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { DEFAULT_GENERATOR_PRESETS } from "./generator-service";
import { createLifeAdminService, getNextWorkshopStatus } from "./life-admin-service";
import { createTestBrainClient, createTestDatabaseUrl, type BrainPrismaClient } from "./test-helpers";

describe("life admin service", () => {
  let db: PrismaClient;
  let brainDb: BrainPrismaClient;
  let service: ReturnType<typeof createLifeAdminService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    brainDb = createTestBrainClient();
    service = createLifeAdminService(brainDb, db);
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

  it("manages per-project steps as an ordered checklist", async () => {
    const project = await service.createPersonalProject({ name: "Steps project" });

    const first = await service.addProjectStep(project.id, "  Clean edges  ");
    const second = await service.addProjectStep(project.id, "Mix gold paste");
    assert.ok(first && second);
    assert.equal(first.title, "Clean edges");
    assert.ok(second.sortOrder > first.sortOrder);

    // Empty titles are ignored.
    assert.equal(await service.addProjectStep(project.id, "   "), null);

    const toggled = await service.setProjectStepDone(first.id, true);
    assert.equal(toggled.done, true);

    const detail = await service.getPersonalProject(project.id);
    assert.equal(detail?.steps.length, 2);
    assert.deepEqual(
      detail?.steps.map((step) => step.title),
      ["Clean edges", "Mix gold paste"],
    );

    await service.deleteProjectStep(second.id);
    const afterDelete = await service.getPersonalProject(project.id);
    assert.equal(afterDelete?.steps.length, 1);
  });

  it("stores and removes project images (Mediathek)", async () => {
    const project = await service.createPersonalProject({ name: "Media project" });

    const image = await service.addProjectImage(project.id, {
      storageKey: "capture/2026/07/demo.png",
      originalFilename: "demo.png",
      mimeType: "image/png",
      caption: "Vorher",
    });
    assert.equal(image.caption, "Vorher");

    const withImages = await service.getPersonalProject(project.id);
    assert.equal(withImages?.images.length, 1);

    const fetched = await service.getProjectImage(image.id);
    assert.equal(fetched?.storageKey, "capture/2026/07/demo.png");

    await service.deleteProjectImage(image.id);
    assert.equal(await service.getProjectImage(image.id), null);
  });

  it("returns personal project dashboard stats by category and status", async () => {
    await service.createPersonalProject({ name: "UWE stats", category: "uwe", status: "active" });
    await service.createPersonalProject({
      name: "Homelab stats",
      category: "hardware_homelab",
      status: "planned",
    });
    await service.createPersonalProject({
      name: "UWE stats done",
      category: "uwe",
      status: "done",
    });

    const stats = await service.getPersonalProjectDashboardStats();
    assert.ok(stats.total >= 3);
    assert.ok(stats.byCategory.uwe >= 2);
    assert.ok(stats.byCategory.hardware_homelab >= 1);
    assert.ok(stats.byStatus.active >= 1);
    assert.ok(stats.byStatus.planned >= 1);
    assert.ok(stats.activeTotal >= 2);
    assert.ok(stats.openTotal >= 2);

    assert.equal(stats.categories.length, 6);
    const uweSummary = stats.categories.find((entry) => entry.category === "uwe");
    assert.ok(uweSummary);
    assert.ok(uweSummary.total >= 2);
    assert.ok(uweSummary.active >= 1);
    assert.ok(uweSummary.done >= 1);
    assert.ok(uweSummary.progressPercent > 0 && uweSummary.progressPercent <= 100);
    assert.ok(uweSummary.recentProjects.length >= 1);
    assert.ok(uweSummary.recentProjects.length <= 3);
    assert.ok(
      uweSummary.recentProjects.some((project) => project.name === "UWE stats done"),
    );

    // Domain tiles and /today must share the same "aktiv" counting logic.
    const summary = await service.getTodaySummary();
    assert.equal(summary.activeProjectCount, stats.activeTotal);
  });

  it("loads personal project detail with linked captures", async () => {
    const project = await service.createPersonalProject({
      name: "Detail test",
      category: "dnd",
      status: "idea",
      notes: "Campaign prep",
      links: [{ label: "Wiki", url: "https://example.com/wiki" }],
      costCents: 1200,
    });

    const detail = await service.getPersonalProjectDetail(project.id);
    assert.ok(detail);
    assert.equal(detail.project.name, "Detail test");
    assert.equal(detail.project.notes, "Campaign prep");
    assert.equal(detail.project.costCents, 1200);
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

    const counts = await service.getHardwareFilterCounts();
    assert.ok(counts.all >= 1);
    assert.ok(counts.active >= 1);
  });

  it("creates personal brain entries", async () => {
    const doc = await service.createPersonalBrainDocument({
      title: "Homelab notes",
      content: "Router config backup location",
      category: "hardware_homelab",
      tags: ["homelab"],
    });

    const fact = await service.createPersonalBrainFact({
      title: "Preferred filament",
      content: "PLA matte black for terrain bases",
      factType: "material",
      tags: ["3d-druck"],
    });

    assert.equal(doc.category, "hardware_homelab");
    assert.equal(fact.factType, "material");
  });

  it("searches personal brain by keyword, category, and tag", async () => {
    await service.createPersonalBrainDocument({
      title: "Router backup",
      content: "NAS share for homelab configs",
      category: "hardware_homelab",
      tags: ["homelab"],
    });
    await service.createPersonalBrainFact({
      title: "Filament stock",
      content: "PLA matte black",
      factType: "material",
      tags: ["3d-druck"],
    });

    const keywordHits = await service.searchPersonalBrain({ query: "homelab" });
    assert.ok(keywordHits.documents.length >= 1);

    const categoryHits = await service.searchPersonalBrain({ category: "hardware_homelab" });
    assert.ok(categoryHits.documents.every((hit) => hit.item.category === "hardware_homelab"));

    const tagHits = await service.searchPersonalBrain({ tag: "3d-druck" });
    assert.ok(tagHits.facts.length >= 1);
  });

  it("promotes capture into life brain and links source capture", async () => {
    const capture = await service.createCapture({
      title: "Filament tip",
      content: "Use matte PLA for bases",
      captureType: "art_miniature_terrain",
      url: "https://example.com/filament",
    });

    const promoted = await service.promoteCaptureToLifeBrain({
      captureId: capture.id,
      category: "printing_3d",
      tags: ["3d-druck"],
    });

    assert.equal(promoted.kind, "document");
    assert.match(promoted.entry.content, /matte PLA/);
    assert.match(promoted.entry.content, /https:\/\/example.com\/filament/);

    const detail = await service.getPersonalBrainDocumentDetail(promoted.entry.id);
    assert.ok(detail);
    assert.equal(detail.linkedCaptures.length, 1);
    assert.equal(detail.linkedCaptures[0]?.id, capture.id);

    const updatedCapture = await service.getCapture(capture.id);
    assert.equal(updatedCapture?.status, "linked");
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

  it("seeds default generator presets and backfills missing system presets", async () => {
    const seeded = await service.ensureDefaultGeneratorPresets();
    assert.equal(seeded, DEFAULT_GENERATOR_PRESETS.length);

    const itemPresets = await service.listGeneratorPresets({
      worldId: null,
      targetType: "item",
    });
    assert.ok(itemPresets.some((preset) => preset.name === "Magische Waffe"));

    await db.generatorPreset.deleteMany({
      where: { isSystem: true, name: "Magische Waffe" },
    });

    const reseeded = await service.ensureDefaultGeneratorPresets();
    assert.equal(reseeded, DEFAULT_GENERATOR_PRESETS.length);

    const restored = await service.listGeneratorPresets({
      worldId: null,
      targetType: "item",
    });
    assert.ok(restored.some((preset) => preset.name === "Magische Waffe"));
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

    const results = await service.searchPersonalBrain({ query: "vlan", limit: 5 });
    assert.ok(results.documents.some((doc) => doc.item.title.includes("Router")));

    const factResults = await service.searchPersonalBrain({ query: "filament", limit: 5 });
    assert.ok(factResults.facts.some((fact) => fact.item.title.includes("Filament")));
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

  it("converts capture to project and links entities", async () => {
    const capture = await service.createCapture({
      title: "UWE feature idea",
      content: "Capture triage workflow",
      captureType: "project_idea",
    });

    const result = await service.convertCaptureToProject(capture.id);
    assert.equal(result.project.name, "UWE feature idea");
    assert.equal(result.capture?.status, "linked");

    const links = await service.listLinksForSource("capture", capture.id);
    assert.ok(links.some((link) => link.targetType === "personal_project"));
  });

  it("converts capture to workshop project", async () => {
    const capture = await service.createCapture({
      title: "Goblin miniature",
      captureType: "art_miniature_terrain",
    });

    const result = await service.convertCaptureToWorkshop(capture.id);
    assert.equal(result.workshop.title, "Goblin miniature");
    assert.equal(result.capture?.status, "linked");
  });

  it("reports capture status counts", async () => {
    await service.createCapture({ title: "Inbox A", status: "inbox" });
    await service.createCapture({ title: "Archived B", status: "archived" });

    const counts = await service.getCaptureStatusCounts();
    assert.ok(counts.inbox >= 1);
    assert.ok(counts.archived >= 1);
  });

  it("advances workshop status along workflow", async () => {
    const workshop = await service.createWorkshopProject({
      title: "Hill tile",
      projectType: "dnd_terrain",
      status: "idea",
    });

    const advanced = await service.advanceWorkshopStatus(workshop.id);
    assert.equal(advanced.status, "planned");
    assert.equal(getNextWorkshopStatus("idea"), "planned");
  });
});
