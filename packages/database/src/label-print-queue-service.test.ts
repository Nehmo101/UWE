import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createConnectorService } from "./connector-service";
import {
  createLabelPrintQueueService,
  LabelPrintDocumentAccessError,
  toPrintListBatchJobPhase,
} from "./label-print-queue-service";
import { createPrintListService } from "./label-print-list-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("LabelPrintQueueService", () => {
  it("enqueues label_print jobs with document path", async () => {
    const dbUrl = createTestDatabaseUrl();
    const isolatedDb = createPrismaClient(dbUrl);
    const connectorService = createConnectorService(isolatedDb);
    const queue = createLabelPrintQueueService(dbUrl);
    const printLists = createPrintListService(dbUrl);
    const world = await isolatedDb.world.create({ data: { slug: `print-q-${Date.now()}`, name: "Test" } });
    const list = await printLists.create({ worldId: world.id, name: "Pack" });
    const { connector } = await connectorService.createConnector("RTX");
    const job = await queue.enqueuePrintList({ worldSlug: world.slug, printListId: list.id, printerId: "p1", targetConnectorId: connector.id });
    assert.equal(job.type, "label_print");
    const row = await isolatedDb.connectorJob.findUnique({ where: { id: job.id } });
    assert.equal((row?.payload as Record<string, unknown>).documentPath, `/api/connectors/print-jobs/${job.id}/document`);
  });

  it("enqueues printer_discover jobs", async () => {
    const dbUrl = createTestDatabaseUrl();
    const connectorService = createConnectorService(createPrismaClient(dbUrl));
    const queue = createLabelPrintQueueService(dbUrl);
    const { connector } = await connectorService.createConnector("RTX2");
    const job = await queue.enqueuePrinterDiscover({ targetConnectorId: connector.id });
    assert.equal(job.type, "printer_discover");
  });

  it("denies label print document access to connectors that did not claim the job", async () => {
    const dbUrl = createTestDatabaseUrl();
    const isolatedDb = createPrismaClient(dbUrl);
    const connectorService = createConnectorService(isolatedDb);
    const queue = createLabelPrintQueueService(dbUrl);
    const printLists = createPrintListService(dbUrl);
    const world = await isolatedDb.world.create({ data: { slug: `print-auth-${Date.now()}`, name: "Test" } });
    const list = await printLists.create({ worldId: world.id, name: "Secure Pack" });
    const { connector: owner } = await connectorService.createConnector("Owner RTX");
    const { connector: intruder } = await connectorService.createConnector("Intruder RTX");
    const job = await queue.enqueuePrintList({
      worldSlug: world.slug,
      printListId: list.id,
      printerId: "p1",
      targetConnectorId: owner.id,
    });

    await assert.rejects(
      () => queue.assertConnectorPrintDocumentAccess(job.id, intruder.id),
      (error: unknown) => {
        assert.ok(error instanceof LabelPrintDocumentAccessError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );

    await isolatedDb.connectorJob.update({
      where: { id: job.id },
      data: { claimedByConnectorId: owner.id, status: "claimed", claimedAt: new Date() },
    });

    await assert.doesNotReject(() => queue.assertConnectorPrintDocumentAccess(job.id, owner.id));
    await assert.rejects(
      () => queue.assertConnectorPrintDocumentAccess(job.id, intruder.id),
      (error: unknown) => {
        assert.ok(error instanceof LabelPrintDocumentAccessError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );
  });
  it("lists label_print jobs for a print list", async () => {
    const dbUrl = createTestDatabaseUrl();
    const isolatedDb = createPrismaClient(dbUrl);
    const connectorService = createConnectorService(isolatedDb);
    const queue = createLabelPrintQueueService(dbUrl);
    const printLists = createPrintListService(dbUrl);
    const world = await isolatedDb.world.create({ data: { slug: `print-list-jobs-${Date.now()}`, name: "Test" } });
    const listA = await printLists.create({ worldId: world.id, name: "Pack A" });
    const listB = await printLists.create({ worldId: world.id, name: "Pack B" });
    const { connector } = await connectorService.createConnector("RTX List");
    await queue.enqueuePrintList({
      worldSlug: world.slug,
      printListId: listA.id,
      printerId: "p1",
      targetConnectorId: connector.id,
    });
    await queue.enqueuePrintList({
      worldSlug: world.slug,
      printListId: listB.id,
      printerId: "p2",
      targetConnectorId: connector.id,
    });

    const jobsForA = await queue.listByPrintList(listA.id, { worldId: world.id });
    assert.equal(jobsForA.length, 1);
    assert.equal(jobsForA[0]?.printListId, listA.id);
    assert.equal(toPrintListBatchJobPhase(jobsForA[0]!.status), "queued");
  });

});
