import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { exportWorldWiki } from "./export-world-wiki";

describe("wiki export", () => {
  let databaseUrl: string;
  let outputDir: string;
  const worldSlug = "wiki-export-test";

  after(async () => {
    if (outputDir) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("exports every page of the world as markdown", async () => {
    databaseUrl = createTestDatabaseUrl();
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-wiki-export-"));
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Wiki Export",
      slug: worldSlug,
    });

    await repo.createPage({
      worldId: world.id,
      title: "Public Town",
      slug: "public-town",
      type: "location",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Visible to everyone.",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Second Town",
      slug: "second-town",
      type: "location",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: "Also exported.",
        },
      ],
    });

    const result = await exportWorldWiki(repo, {
      worldSlug,
      outputDir,
      format: "markdown",
    });

    assert.equal(result.pageCount, 2);
    assert.ok(fs.existsSync(path.join(outputDir, "public-town.md")));
    assert.ok(fs.existsSync(path.join(outputDir, "second-town.md")));

    const markdown = fs.readFileSync(path.join(outputDir, "public-town.md"), "utf8");
    assert.match(markdown, /title: Public Town/);
    assert.match(markdown, /Visible to everyone/);
  });
});
