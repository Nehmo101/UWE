import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { executeMarkdownImport } from "./import-central-service";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUndoService } from "./undo-service";

describe("import central undo", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("undoes personal brain markdown import", async () => {
    const lifeAdmin = createLifeAdminService(db);
    const undo = createUndoService(db);
    const beforeCount = (await lifeAdmin.listPersonalBrainDocuments()).length;

    const result = await executeMarkdownImport(db, "# Undo Test\n\nInhalt", {
      sourceType: "markdown",
      targetType: "personal_brain",
    });

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
    const lifeAdmin = createLifeAdminService(db);
    const undo = createUndoService(db);
    const beforeCount = (await lifeAdmin.listCaptures({ status: "inbox" })).length;

    const result = await executeMarkdownImport(db, "# Capture Undo\n\nText", {
      sourceType: "markdown",
      targetType: "capture",
    });

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
