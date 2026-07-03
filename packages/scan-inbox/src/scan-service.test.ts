import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/server";
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
});
