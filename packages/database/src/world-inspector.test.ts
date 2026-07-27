import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  buildCanonFindings,
  buildSafetyFindings,
  createWorldInspectorService,
  sortFindings,
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
    visibility: "dm_only",
    canonicalStatus: "draft",
    aliases: [],
    blocks: [],
    ...overrides,
  };
}

describe("world-inspector findings", () => {
  it("flags gm_note blocks marked player-visible as critical", () => {
    const pages = [
      makePage({
        title: "Validori",
        slug: "validori",
        visibility: "public",
        blocks: [
          { type: "gm_note", visibility: "player_visible", content: "Geheimplan!" },
        ],
      }),
    ];

    const findings = buildSafetyFindings("terra", pages, { publicSharingEnabled: true });
    const leak = findings.find((f) => f.code === "gm_note_player_visible");
    assert.ok(leak);
    assert.equal(leak.severity, "critical");
  });

  it("flags portal-visible secret pages as critical", () => {
    const pages = [
      makePage({
        title: "Das dunkle Ritual",
        slug: "das-dunkle-ritual",
        type: "secret",
        visibility: "player_visible",
      }),
    ];

    const findings = buildSafetyFindings("terra", pages, { publicSharingEnabled: true });
    assert.ok(findings.some((f) => f.code === "secret_page_portal_visible"));
  });

  it("reports hidden link placeholders in portal pages as info", () => {
    const pages = [
      makePage({
        id: "a",
        title: "Validori",
        slug: "validori",
        visibility: "public",
        blocks: [
          {
            type: "rich_text",
            visibility: "public",
            content: "Im Norden liegt [[Shagottar]].",
          },
        ],
      }),
      makePage({
        id: "b",
        title: "Shagottar",
        slug: "shagottar",
        visibility: "dm_only",
      }),
    ];

    const findings = buildSafetyFindings("terra", pages, { publicSharingEnabled: true });
    const hidden = findings.find((f) => f.code === "hidden_link_in_portal_page");
    assert.ok(hidden);
    assert.equal(hidden.severity, "info");
  });

  it("does not flag dm_only links inside dm_only blocks", () => {
    const pages = [
      makePage({
        id: "a",
        title: "Validori",
        slug: "validori",
        visibility: "public",
        blocks: [
          { type: "gm_note", visibility: "dm_only", content: "Hier liegt [[Shagottar]]." },
        ],
      }),
      makePage({
        id: "b",
        title: "Shagottar",
        slug: "shagottar",
        visibility: "dm_only",
      }),
    ];

    const findings = buildSafetyFindings("terra", pages, { publicSharingEnabled: true });
    assert.ok(!findings.some((f) => f.code === "hidden_link_in_portal_page"));
  });


  it("detects broken wiki links", () => {
    const pages = [
      makePage({
        title: "Arbor",
        slug: "arbor",
        blocks: [
          { type: "rich_text", visibility: "public", content: "Siehe [[Gibt Es Nicht]]." },
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

  it("flags contradictory pages and inconsistent publish states", () => {
    const pages = [
      makePage({
        id: "a",
        title: "Alte Chronik",
        slug: "alte-chronik",
        canonicalStatus: "contradictory",
      }),
      makePage({
        id: "b",
        title: "Marktplatz",
        slug: "marktplatz",
        visibility: "player_visible",
      }),
      makePage({
        id: "c",
        title: "Kriegsplan",
        slug: "kriegsplan",
        visibility: "dm_only",
      }),
    ];

    const findings = buildCanonFindings("terra", pages);
    assert.ok(findings.some((f) => f.code === "contradictory_page"));
    assert.ok(findings.some((f) => f.code === "published_but_dm_only" && f.pageTitle === "Kriegsplan"));
  });

  it("finds orphan pages without any relations", () => {
    const pages = [
      makePage({
        id: "a",
        title: "Validori",
        slug: "validori",
        blocks: [{ type: "rich_text", visibility: "public", content: "Nahe [[Arbor]]." }],
      }),
      makePage({ id: "b", title: "Arbor", slug: "arbor" }),
      makePage({ id: "c", title: "Vergessene Insel", slug: "vergessene-insel" }),
    ];

    const findings = buildCanonFindings("terra", pages);
    const orphans = findings.filter((f) => f.code === "orphan_page");
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].pageTitle, "Vergessene Insel");
  });

  it("sorts findings by severity", () => {
    const sorted = sortFindings([
      { id: "orphan_page:x", code: "orphan_page", severity: "info", message: "c", fixes: [] },
      {
        id: "gm_note_player_visible:x",
        code: "gm_note_player_visible",
        severity: "critical",
        message: "a",
        fixes: [],
      },
      {
        id: "broken_wiki_link:x",
        code: "broken_wiki_link",
        severity: "warning",
        message: "b",
        fixes: [],
      },
    ]);

    assert.deepEqual(
      sorted.map((f) => f.severity),
      ["critical", "warning", "info"],
    );
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
      visibility: "public",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "public", content: "Schöner Hafen." },
        { type: "gm_note", sortOrder: 1, visibility: "dm_only", content: "Schmuggler!" },
      ],
    });

    await repo.createPage({
      worldId: world.id,
      title: "Geheimversteck",
      slug: "geheimversteck",
      type: "location",
      visibility: "dm_only",
    });
  });

  it("builds a full report for a world", async () => {
    const report = await service.inspectWorld("inspector-test");
    assert.ok(report);

    assert.equal(report.visiblePages.length, 1);
    assert.equal(report.visiblePages[0].title, "Hafenstadt");
    assert.equal(report.visiblePages[0].visibleBlockCount, 1);
    assert.equal(report.visiblePages[0].hiddenBlockCount, 1);


  });

  it("returns null for unknown worlds", async () => {
    assert.equal(await service.inspectWorld("does-not-exist"), null);
  });
});
