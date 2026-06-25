import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  createImageStudioService,
  extractImageStudioErrorMessage,
  imageStudioStatusBadgeClass,
} from "./integrations-service";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("image studio status helpers", () => {
  it("maps status values to badge classes", () => {
    assert.equal(imageStudioStatusBadgeClass("completed"), "uwe-badge uwe-badge-success");
    assert.equal(imageStudioStatusBadgeClass("processing"), "uwe-badge uwe-badge-warning");
    assert.equal(imageStudioStatusBadgeClass("failed"), "uwe-badge uwe-badge-danger");
    assert.equal(imageStudioStatusBadgeClass("draft"), "uwe-badge");
  });

  it("extracts lastError from project metadata", () => {
    assert.equal(
      extractImageStudioErrorMessage({ lastError: "RTX offline" }),
      "RTX offline",
    );
    assert.equal(extractImageStudioErrorMessage({}), null);
    assert.equal(extractImageStudioErrorMessage(null), null);
  });
});

describe("ImageStudioService markProjectFailed", () => {
  let db: PrismaClient;
  let projectId: string;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Image Studio Fail World",
      slug: "image-studio-fail-world",
      description: "Failed status tests",
    });
    const imageStudio = createImageStudioService(db);
    const project = await imageStudio.createProject({
      worldId: world.id,
      title: "Portrait draft",
      prompt: "A wizard",
    });
    projectId = project.id;
    await imageStudio.updateProjectStatus(projectId, "processing");
  });

  it("sets failed status and stores error metadata", async () => {
    const imageStudio = createImageStudioService(db);
    const failed = await imageStudio.markProjectFailed(projectId, "RTX Agent offline");

    assert.equal(failed.status, "failed");
    assert.equal(extractImageStudioErrorMessage(failed.metadata), "RTX Agent offline");
  });
});
