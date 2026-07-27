import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { scanPublicContentLeaks } from "./public-leak-scanner";
import { createTestDatabaseUrl } from "./test-helpers";

describe("public leak scanner", () => {
  let db: PrismaClient;
  const worldSlug = "leak-scan-test";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({ name: "Leak Scan", slug: worldSlug });

    await repo.createPage({
      worldId: world.id,
      title: "Geheimplan",
      slug: "geheimplan",
      type: "lore",
      visibility: "player_visible",
      contentBlocks: [
        {
          type: "gm_note",
          sortOrder: 0,
          visibility: "player_visible",
          content: "STRENG GEHEIM: Boss-Schwäche",
        },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Marktplatz",
      slug: "marktplatz",
      type: "location",
      visibility: "player_visible",
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          visibility: "player_visible",
          content: "Belebter Markt.",
        },
        {
          type: "gm_note",
          sortOrder: 1,
          visibility: "dm_only",
          content: "GEHEIM: Diebesgilde",
        },
      ],
    });
  });

  it("detects GM blocks in portal-visible pages", async () => {
    const result = await scanPublicContentLeaks(db);
    assert.ok(result.findingCount > 0);

    const gmBlock = result.findings.find((f) => f.id.startsWith("block:gm-type-portal-visible"));
    assert.ok(gmBlock);
    assert.equal(gmBlock?.severity, "warning");

    const dmBlock = result.findings.find((f) => f.id.startsWith("block:dm-only-in-portal-page"));
    assert.ok(dmBlock);
    assert.equal(dmBlock?.severity, "critical");

    const suspicious = result.findings.find((f) => f.id.startsWith("block:suspicious-text"));
    assert.ok(suspicious);
  });
});
