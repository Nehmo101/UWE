import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createConnectorService } from "./connector-service";
import { createLabelPrintQueueService } from "./label-print-queue-service";
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
});
