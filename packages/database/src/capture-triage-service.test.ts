import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import {
  buildCaptureAiProposal,
  CAPTURE_TRIAGE_ACTION_LABELS,
  createCaptureTriageService,
  parseCaptureAiProposal,
} from "./capture-triage-service";
import { QUICK_CAPTURE_TYPE_OPTIONS } from "./capture-constants";
import { createLifeAdminService } from "./life-admin-service";

describe("capture triage service", () => {
  let db: PrismaClient;
  let lifeAdmin: ReturnType<typeof createLifeAdminService>;
  let triage: ReturnType<typeof createCaptureTriageService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    lifeAdmin = createLifeAdminService(db);
    triage = createCaptureTriageService(db);
  });

  it("exposes quick capture type options for mobile UI", () => {
    assert.ok(QUICK_CAPTURE_TYPE_OPTIONS.length >= 9);
    assert.ok(QUICK_CAPTURE_TYPE_OPTIONS.some((option) => option.id === "life_brain"));
    assert.ok(QUICK_CAPTURE_TYPE_OPTIONS.some((option) => option.captureType === "file_image"));
  });

  it("labels all triage actions in German", () => {
    assert.equal(CAPTURE_TRIAGE_ACTION_LABELS.to_life_brain, "Ins Life Brain übernehmen");
    assert.equal(CAPTURE_TRIAGE_ACTION_LABELS.archive, "Archivieren");
  });

  it("builds heuristic AI proposals as draft without auto-apply", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "NPC Händlerin",
      content: "Questgeberin in der Hafenstadt",
      captureType: "dnd_idea",
    });

    const proposal = buildCaptureAiProposal(capture);
    assert.equal(proposal.status, "draft");
    assert.equal(proposal.source, "heuristic");
    assert.equal(proposal.suggestedTarget, "dnd_page");
    assert.ok(proposal.suggestedTags.includes("dnd_idea"));
    assert.match(proposal.suggestedNextAction, /DnD/i);
  });

  it("stores proposal in capture metadata via ensureAiProposal", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "RTX Server offline",
      content: "NAS antwortet nicht nach Update",
      captureType: "hardware",
    });

    const proposal = await triage.ensureAiProposal(capture.id);
    assert.equal(proposal.suggestedTarget, "hardware_device");

    const refreshed = await lifeAdmin.getCapture(capture.id);
    assert.ok(refreshed);
    const parsed = parseCaptureAiProposal(refreshed);
    assert.equal(parsed?.status, "draft");
    assert.equal(parsed?.suggestedTarget, "hardware_device");
  });

  it("promotes capture to personal project and links it", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "UWE Capture 2.0",
      content: "Triage UI fertigstellen",
      captureType: "uwe_todo",
    });

    const result = await triage.executeTriage(capture.id, "to_personal_project");
    assert.equal(result.targetType, "personal_project");
    assert.ok(result.targetId);

    const updated = await lifeAdmin.getCapture(capture.id);
    assert.equal(updated?.status, "linked");

    const links = await lifeAdmin.listLinksForSource("capture", capture.id);
    assert.ok(links.some((link) => link.targetType === "personal_project"));
  });

  it("promotes capture to workshop project", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "Forest tiles",
      content: "XPS foam terrain für DnD battlemap",
      captureType: "art_miniature_terrain",
    });

    const result = await triage.executeTriage(capture.id, "to_workshop_project");
    assert.equal(result.targetType, "workshop_project");
    assert.equal(result.redirectPath, "/workshop");
  });

  it("promotes capture to contract expense", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "Cloudflare Pro",
      content: "Rechnung prüfen",
      captureType: "contract_expense",
      url: "https://dash.cloudflare.com",
    });

    const result = await triage.executeTriage(capture.id, "to_contract");
    assert.equal(result.targetType, "contract_expense");
  });

  it("promotes capture to life brain fact", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "Filament Tipp",
      content: "PLA matte für Terrain-Bases",
      captureType: "quick_note",
      metadata: { captureIntent: "life_brain" },
    });

    const result = await triage.executeTriage(capture.id, "to_life_brain");
    assert.ok(
      result.targetType === "personal_brain_fact" ||
        result.targetType === "personal_brain_document",
    );
    assert.equal(result.redirectPath, "/life-brain");
  });

  it("appends notes when attaching to existing hardware device", async () => {
    const device = await lifeAdmin.createHardwareDevice({
      name: "NAS",
      status: "active",
      errorNotes: "Bisher stabil",
    });
    const capture = await lifeAdmin.createCapture({
      title: "Disk warning",
      content: "SMART meldet Fehler",
      captureType: "hardware",
    });

    const result = await triage.executeTriage(capture.id, "to_hardware_device", {
      hardwareDeviceId: device.id,
    });
    assert.equal(result.targetId, device.id);

    const refreshed = await lifeAdmin.getHardwareDevice(device.id);
    assert.match(refreshed?.errorNotes ?? "", /SMART/);
  });

  it("archives and deletes captures", async () => {
    const capture = await lifeAdmin.createCapture({ title: "Archive me" });
    await triage.executeTriage(capture.id, "archive");
    const archived = await lifeAdmin.getCapture(capture.id);
    assert.equal(archived?.status, "archived");

    const toDelete = await lifeAdmin.createCapture({ title: "Delete me" });
    await triage.executeTriage(toDelete.id, "delete");
    assert.equal(await lifeAdmin.getCapture(toDelete.id), null);
  });

  it("marks proposal accepted without executing triage automatically", async () => {
    const capture = await lifeAdmin.createCapture({
      title: "Miniatur Idee",
      content: "Goblin Schurke bemalt",
      captureType: "art_miniature_terrain",
    });
    await triage.ensureAiProposal(capture.id);
    const accepted = await triage.updateAiProposalStatus(capture.id, "accepted");
    assert.equal(accepted.status, "accepted");

    const refreshed = await lifeAdmin.getCapture(capture.id);
    assert.equal(parseCaptureAiProposal(refreshed!)?.status, "accepted");
    assert.equal(refreshed?.status, "inbox");
  });
});
