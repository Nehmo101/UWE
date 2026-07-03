import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createConnectorService,
  createPrismaClient,
  createUweRepositoryFromClient,
} from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createScanInboxService } from "./scan-service";

describe("scan inbox service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates, analyzes and files an invoice scan as a contract", async () => {
    const service = createScanInboxService(db);
    const scan = await service.create({ storageKey: "_scan/a.jpg", mimeType: "image/jpeg" });
    assert.equal(scan.status, "unanalyzed");

    const analyzed = await service.applyAnalysis(scan.id, {
      ocrText: "Stadtwerke\nRechnung\nRechnungsbetrag 84,99 €\nzahlbar bis 15.07.2026\nRechnungsnummer 7",
      ocrEngine: "vision_llm",
    });
    assert.equal(analyzed.status, "proposal_ready");
    assert.equal(analyzed.detectedKind, "invoice");
    assert.equal(analyzed.proposal?.target, "contract");
    assert.equal(analyzed.extractedFields?.amountCents, 8499);

    const filed = await service.file(scan.id, "contract");
    assert.equal(filed.targetType, "contract_expense");
    assert.ok(filed.targetId);

    const reloaded = await service.get(scan.id);
    assert.equal(reloaded?.status, "filed");
    assert.equal(reloaded?.filedTargetType, "contract_expense");

    const contract = await db.contractExpense.findUnique({ where: { id: filed.targetId! } });
    assert.equal(contract?.amountCents, 8499);
    assert.equal(contract?.vendor, "Stadtwerke");
  });

  it("routes an unknown scan to uncertain and files it as a capture", async () => {
    const service = createScanInboxService(db);
    const scan = await service.create({ storageKey: "_scan/b.jpg", mimeType: "image/jpeg" });
    const analyzed = await service.applyAnalysis(scan.id, {
      ocrText: "unklarer text",
      ocrEngine: "vision_llm",
    });
    assert.equal(analyzed.status, "uncertain");

    const filed = await service.file(scan.id, "capture");
    assert.equal(filed.targetType, "capture");
    const capture = await db.captureEntry.findUnique({ where: { id: filed.targetId! } });
    assert.equal(capture?.captureType, "quick_note");
  });

  it("lists by status and rejects", async () => {
    const service = createScanInboxService(db);
    const scan = await service.create({ storageKey: "_scan/c.jpg", mimeType: "image/jpeg" });
    await service.reject(scan.id);
    const rejected = await service.list("rejected");
    assert.ok(rejected.some((s) => s.id === scan.id));
  });

  it("writes back a completed vision job result and analyzes it", async () => {
    const service = createScanInboxService(db);
    const scan = await service.create({ storageKey: "_scan/v.jpg", mimeType: "image/jpeg" });

    const job = await createConnectorService(db).enqueueJob({
      type: "vision_extract",
      payload: { prompt: "x", images: ["=="] },
    });
    await service.setConnectorJob(scan.id, job.id);
    // Still running → stays analyzing.
    const pending = await service.applyConnectorJobResult(scan.id);
    assert.equal(pending?.status, "analyzing");

    // Simulate the connector finishing with transcribed text.
    await db.connectorJob.update({
      where: { id: job.id },
      data: { status: "completed", result: { text: "Vertrag mit Kündigungsfrist, Betrag 12,00 €" } },
    });
    const done = await service.applyConnectorJobResult(scan.id);
    assert.equal(done?.status, "proposal_ready");
    assert.equal(done?.ocrEngine, "vision_llm");
    assert.equal(done?.detectedKind, "contract_doc");
  });

  it("files to life-brain, calendar and recipe drafts", async () => {
    const service = createScanInboxService(db);

    const brainScan = await service.create({ storageKey: "_scan/b1", mimeType: "image/jpeg" });
    await service.applyAnalysis(brainScan.id, { ocrText: "Garantie bis 03.07.2028 für Gerät X", ocrEngine: "manual" });
    const brainFiled = await service.file(brainScan.id, "life_brain");
    assert.equal(brainFiled.targetType, "personal_brain_document");
    assert.ok(await db.personalBrainDocument.findUnique({ where: { id: brainFiled.targetId! } }));

    const calScan = await service.create({ storageKey: "_scan/b2", mimeType: "image/jpeg" });
    await service.applyAnalysis(calScan.id, { ocrText: "Rechnung zahlbar bis 15.07.2026 84,99 €", ocrEngine: "manual" });
    const calFiled = await service.file(calScan.id, "calendar_event");
    assert.equal(calFiled.targetType, "calendar_event");
    assert.ok(await db.calendarEvent.findUnique({ where: { id: calFiled.targetId! } }));

    const recipeScan = await service.create({ storageKey: "_scan/b3", mimeType: "image/jpeg" });
    await service.applyAnalysis(recipeScan.id, { ocrText: "Zutaten: Mehl, Wasser. Zubereitung: backen.", ocrEngine: "manual" });
    const recipeFiled = await service.file(recipeScan.id, "recipe");
    assert.equal(recipeFiled.targetType, "recipe");
    const recipe = await db.recipe.findUnique({ where: { id: recipeFiled.targetId! } });
    assert.equal(recipe?.status, "draft");
    assert.equal(recipe?.sourceScanId, recipeScan.id);
  });

  it("files DnD scans as draft world pages (S2)", async () => {
    const service = createScanInboxService(db);
    const world = await createUweRepositoryFromClient(db).createWorld({ name: "Terra", slug: "scan-dnd" });

    // Session note → gm_note draft page.
    const sessScan = await service.create({ storageKey: "_scan/s1", mimeType: "image/jpeg" });
    await service.setDndWorld(sessScan.id, world.id);
    await service.applyAnalysis(sessScan.id, {
      ocrText: "Session-Notizen: die Gruppe traf den NPC und nahm die Quest an. Würfel fielen gut.",
      ocrEngine: "manual",
    });
    const sessFiled = await service.file(sessScan.id, "dnd_session_note");
    assert.equal(sessFiled.targetType, "page");
    const sessPage = await db.page.findUnique({
      where: { id: sessFiled.targetId! },
      include: { contentBlocks: true },
    });
    assert.equal(sessPage?.type, "session");
    assert.equal(sessPage?.canonicalStatus, "draft");
    assert.equal(sessPage?.contentBlocks[0]?.type, "gm_note");

    // Handout → player-visible draft page.
    const handoutScan = await service.create({ storageKey: "_scan/h1", mimeType: "image/jpeg" });
    await service.setDndWorld(handoutScan.id, world.id);
    await service.applyAnalysis(handoutScan.id, { ocrText: "Ein alter Brief an die Abenteurer.", ocrEngine: "manual" });
    const handoutFiled = await service.file(handoutScan.id, "dnd_handout");
    const handoutPage = await db.page.findUnique({
      where: { id: handoutFiled.targetId! },
      include: { contentBlocks: true },
    });
    assert.equal(handoutPage?.type, "handout");
    assert.equal(handoutPage?.contentBlocks[0]?.type, "player_text");
    assert.equal(handoutPage?.contentBlocks[0]?.visibility, "player_visible");
  });

  it("refuses DnD filing without an assigned world", async () => {
    const service = createScanInboxService(db);
    const scan = await service.create({ storageKey: "_scan/nw", mimeType: "image/jpeg" });
    await service.applyAnalysis(scan.id, { ocrText: "Session-Notiz", ocrEngine: "manual" });
    await assert.rejects(() => service.file(scan.id, "dnd_session_note"), /Welt/);
  });
});
