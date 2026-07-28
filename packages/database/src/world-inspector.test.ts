import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  buildCanonFindings,
  createWorldInspectorService,
  type InspectorPageInput,
  type WorldInspectorService,
} from "./world-inspector";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

function makePage(overrides: Partial<InspectorPageInput>): InspectorPageInput {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    title: "Seite",
    slug: "seite",
    type: "lore",
    canonicalStatus: "draft",
    aliases: [],
    blocks: [],
    ...overrides,
  };
}

describe("world-inspector findings", () => {





  it("detects broken wiki links", () => {
    const pages = [
      makePage({
        title: "Arbor",
        slug: "arbor",
        blocks: [
          { type: "rich_text", content: "Siehe [[Gibt Es Nicht]]." },
        ],
      }),
    ];

    const findings = buildCanonFindings("terra", pages);
    const broken = findings.find((f) => f.code === "broken_wiki_link");
    assert.ok(broken);
    assert.match(broken.message, /Gibt Es Nicht/);
  });

  it("detects ambiguous duplicate names across titles and aliases", () => {
    const pages = [
      makePage({ id: "a", title: "Mara", slug: "mara-npc" }),
      makePage({ id: "b", title: "Kapitänin", slug: "kapitaenin", aliases: ["Mara"] }),
    ];

    const findings = buildCanonFindings("terra", pages);
    assert.ok(findings.some((f) => f.code === "duplicate_name"));
  });


  it("finds orphan pages without any relations", () => {
    const pages = [
      makePage({
        id: "a",
        title: "Validori",
        slug: "validori",
        blocks: [{ type: "rich_text", content: "Nahe [[Arbor]]." }],
      }),
      makePage({ id: "b", title: "Arbor", slug: "arbor" }),
      makePage({ id: "c", title: "Vergessene Insel", slug: "vergessene-insel" }),
    ];

    const findings = buildCanonFindings("terra", pages);
    const orphans = findings.filter((f) => f.code === "orphan_page");
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].pageTitle, "Vergessene Insel");
  });

});

describe("world-inspector service", () => {
  let service: WorldInspectorService;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    service = createWorldInspectorService(db);

    const world = await repo.createWorld({ name: "Inspector Test", slug: "inspector-test" });

    await repo.createPage({
      worldId: world.id,
      title: "Hafenstadt",
      slug: "hafenstadt",
      type: "location",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, content: "Schöner Hafen." },
        { type: "rich_text", sortOrder: 1, content: "Schmuggler!" },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Geheimversteck",
      slug: "geheimversteck",
      type: "location",
    });
  });


  it("returns null for unknown worlds", async () => {
    assert.equal(await service.inspectWorld("does-not-exist"), null);
  });
});
