import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  createPromptLibraryService,
  extractVariables,
  fillPrompt,
} from "./prompt-library-service";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("prompt variables (pure)", () => {
  it("extracts unique variables in order of appearance", () => {
    assert.deepEqual(
      extractVariables("Audit {{repo}} auf {{ topic }} — {{repo}} nochmal"),
      ["repo", "topic"],
    );
    assert.deepEqual(extractVariables("keine variablen"), []);
  });

  it("fills variables and blanks unknown placeholders", () => {
    assert.equal(
      fillPrompt("Fix {{area}} in {{repo}}", { area: "Nav", repo: "UWE" }),
      "Fix Nav in UWE",
    );
    assert.equal(fillPrompt("Hallo {{name}}", {}), "Hallo ");
  });
});

describe("prompt library service (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates, auto-extracts variables, lists by category and updates", async () => {
    const service = createPromptLibraryService(db);
    const created = await service.create({
      title: "Repo-Audit",
      category: "repo_audit",
      body: "Prüfe {{package}} auf {{aspect}}.",
      tags: ["audit"],
    });
    assert.deepEqual(created.variables, ["package", "aspect"]);

    const byCategory = await service.list("repo_audit");
    assert.ok(byCategory.some((p) => p.id === created.id));
    assert.equal((await service.list("ui_fix")).length, 0);

    const updated = await service.update(created.id, {
      title: "Repo-Audit v2",
      category: "repo_audit",
      body: "Nur noch {{package}}.",
    });
    assert.deepEqual(updated.variables, ["package"]);

    await service.remove(created.id);
    assert.equal(await service.get(created.id), null);
  });
});
