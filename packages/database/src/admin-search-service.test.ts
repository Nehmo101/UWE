import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import { searchAdminEntities } from "./admin-search-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("admin search service", () => {
  let db: PrismaClient;
  let service: ReturnType<typeof createLifeAdminService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    service = createLifeAdminService(db);
  });

  it("returns empty results for short queries", async () => {
    const results = await searchAdminEntities(db, { query: "a" });
    assert.deepEqual(results, []);
  });

  it("finds personal projects and captures by title", async () => {
    const project = await service.createPersonalProject({
      name: "Alpha Admin Search Project",
      status: "active",
      nextAction: "Review wave 2 UI",
    });
    const capture = await service.createCapture({
      title: "Alpha Admin Search Capture",
      content: "Something unique for admin search",
      captureType: "quick_note",
    });

    const projectResults = await searchAdminEntities(db, {
      query: "alpha admin search project",
      entityType: "personal_project",
      limit: 10,
    });
    assert.ok(projectResults.some((entry) => entry.id === project.id));
    assert.equal(projectResults[0]?.entityType, "personal_project");
    assert.equal(projectResults[0]?.href, `/projects/${project.id}`);

    const captureResults = await searchAdminEntities(db, {
      query: "alpha admin search capture",
      entityType: "capture",
      limit: 10,
    });
    assert.ok(captureResults.some((entry) => entry.id === capture.id));
    assert.equal(captureResults[0]?.href, `/capture/${capture.id}`);
    assert.match(captureResults[0]?.group ?? "", /Capture/);
  });
});
