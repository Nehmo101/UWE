import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { executeMarkdownImport } from "./import-central-service";
import {
  createTestBrainClient,
  createTestDatabaseUrl,
  type BrainPrismaClient,
} from "./test-helpers";
import { createUndoService } from "./undo-service";

describe("import central undo", () => {
  let db: ReturnType<typeof createPrismaClient>;
  // Deliberately NOT the `brainPrisma` singleton: node --test runs test files
  // in parallel processes that all share the one BRAIN_DATABASE_URL the test
  // runner provisions (and, run standalone, the singleton points at the
  // developer's default brain DB). This test asserts absolute document counts,
  // so it needs a brain DB nobody else writes to.
  let brainDb: BrainPrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
    brainDb = createTestBrainClient();
  });

  after(async () => {
    await db.$disconnect();
    await brainDb.$disconnect();
  });

  it("undoes personal brain markdown import", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const undo = createUndoService(brainDb, db);
    const beforeCount = (await lifeAdmin.listPersonalBrainDocuments()).length;

    const result = await executeMarkdownImport(
      db,
      "# Undo Test\n\nInhalt",
      {
        sourceType: "markdown",
        targetType: "personal_brain",
      },
      { brainDb },
    );

    assert.equal(result.created, 1);
    assert.equal((await lifeAdmin.listPersonalBrainDocuments()).length, beforeCount + 1);

    const entry = await undo.captureImportCentralExecute({
      targetType: "personal_brain",
      jobId: "test-job",
      createdPersonalBrainDocumentIds: result.createdIds,
    });
    assert.ok(entry);

    const undone = await undo.undo(entry.id);
    assert.equal(undone.ok, true);
    assert.equal((await lifeAdmin.listPersonalBrainDocuments()).length, beforeCount);
  });

  it("undoes capture markdown import", async () => {
    const lifeAdmin = createLifeAdminService(brainDb, db);
    const undo = createUndoService(brainDb, db);
    const beforeCount = (await lifeAdmin.listCaptures({ status: "inbox" })).length;

    const result = await executeMarkdownImport(
      db,
      "# Capture Undo\n\nText",
      {
        sourceType: "markdown",
        targetType: "capture",
      },
      { brainDb },
    );

    assert.equal(result.created, 1);

    const entry = await undo.captureImportCentralExecute({
      targetType: "capture",
      jobId: "capture-job",
      createdCaptureIds: result.createdIds,
    });
    assert.ok(entry);

    const undone = await undo.undo(entry!.id);
    assert.equal(undone.ok, true);
    assert.equal((await lifeAdmin.listCaptures({ status: "inbox" })).length, beforeCount);
  });
});
