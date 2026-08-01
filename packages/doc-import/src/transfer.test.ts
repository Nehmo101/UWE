import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import { createUweRepository, type UweRepository } from "@uwe/database/server";
import { previewTransferPages, transferPagesToWorld } from "./transfer";

/** Werkstatt-Welt mit einem kleinen Band, wie ihn der PDF-Import hinterlässt. */
async function seedWorkshop(repo: UweRepository) {
  const workshop = await repo.createWorld({ name: "Steinbruch", slug: "steinbruch" });
  await repo.createWorld({ name: "Terra", slug: "terra-ziel" });

  const book = await repo.createPage({
    worldId: workshop.id,
    title: "Obojima",
    slug: "obojima",
    type: "lore",
    contentBlocks: [{ type: "rich_text", sortOrder: 0, content: "<p>Ein Band.</p>" }],
  });

  const region = await repo.createPage({
    worldId: workshop.id,
    parentPageId: book.id,
    sortIndex: 0,
    title: "Die Hohe Wiese",
    slug: "die-hohe-wiese",
    type: "region",
    contentBlocks: [
      { type: "rich_text", sortOrder: 0, content: "<p>Grenzt an [[Obojima]] und [[Ferlor]].</p>" },
    ],
  });

  const npc = await repo.createPage({
    worldId: workshop.id,
    parentPageId: region.id,
    sortIndex: 0,
    title: "Die Kesselhexe",
    slug: "die-kesselhexe",
    type: "npc",
    tags: ["nsc"],
    contentBlocks: [{ type: "rich_text", sortOrder: 0, content: "<p>Rührt.</p>" }],
  });

  return { workshop, book, region, npc };
}

describe("transferPagesToWorld", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    const { createPrismaClient } = await import("@uwe/database/client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("takes the subtree along and keeps the hierarchy", async () => {
    const repo = createUweRepository(databaseUrl);
    const { region } = await seedWorkshop(repo);

    const result = await transferPagesToWorld(repo, {
      sourceWorldSlug: "steinbruch",
      targetWorldSlug: "terra-ziel",
      pageIds: [region.id],
      confirmed: true,
    });

    assert.equal(result.created, 2, "Region plus ihre Unterseite");
    assert.equal(result.failed, 0);

    const copiedRegion = await repo.getPageBySlug("terra-ziel", "die-hohe-wiese");
    const copiedNpc = await repo.getPageBySlug("terra-ziel", "die-kesselhexe");

    assert.ok(copiedRegion && copiedNpc);
    assert.equal(copiedNpc.parentPageId, copiedRegion.id);
    assert.equal(copiedNpc.type, "npc");
    assert.deepEqual(copiedNpc.tags, ["nsc"]);
    // Das Elternteil kam nicht mit, also steht die Region in der Zielwelt oben.
    assert.equal(copiedRegion.parentPageId, null);
  });

  it("records where a page came from", async () => {
    const repo = createUweRepository(databaseUrl);
    const copied = await repo.getPageBySlug("terra-ziel", "die-kesselhexe");
    const metadata = copied?.contentBlocks[0]?.metadata as Record<string, unknown> | undefined;
    const from = metadata?.transferredFrom as Record<string, unknown> | undefined;

    assert.equal(from?.worldSlug, "steinbruch");
    assert.equal(from?.slug, "die-kesselhexe");
  });

  it("reports links that will dangle in the target world", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({ name: "Zweitziel", slug: "zweitziel" });
    assert.ok(world);

    const source = await repo.listPagesByWorld("steinbruch");
    const region = source.find((page) => page.slug === "die-hohe-wiese");
    assert.ok(region);

    const preview = await previewTransferPages(repo, {
      sourceWorldSlug: "steinbruch",
      targetWorldSlug: "zweitziel",
      pageIds: [region.id],
    });

    // `[[Obojima]]` bleibt in der Werkstatt, `[[Ferlor]]` gibt es nirgends.
    assert.ok(preview.danglingLinks.includes("Obojima"));
    assert.ok(preview.danglingLinks.includes("Ferlor"));
    assert.ok(preview.warnings.some((warning) => warning.includes("ins Leere")));
  });

  it("marks pages that only came along because of the subtree", async () => {
    const repo = createUweRepository(databaseUrl);
    const source = await repo.listPagesByWorld("steinbruch");
    const region = source.find((page) => page.slug === "die-hohe-wiese");
    assert.ok(region);

    const preview = await previewTransferPages(repo, {
      sourceWorldSlug: "steinbruch",
      targetWorldSlug: "zweitziel",
      pageIds: [region.id],
    });

    assert.deepEqual(
      preview.items.map((item) => [item.title, item.implicit]),
      [
        ["Die Hohe Wiese", false],
        ["Die Kesselhexe", true],
      ],
    );
  });

  it("can leave the descendants behind", async () => {
    const repo = createUweRepository(databaseUrl);
    const source = await repo.listPagesByWorld("steinbruch");
    const region = source.find((page) => page.slug === "die-hohe-wiese");
    assert.ok(region);

    const preview = await previewTransferPages(repo, {
      sourceWorldSlug: "steinbruch",
      targetWorldSlug: "zweitziel",
      pageIds: [region.id],
      includeDescendants: false,
    });

    assert.equal(preview.items.length, 1);
  });

  it("gives a colliding slug a suffix in the target world", async () => {
    const repo = createUweRepository(databaseUrl);
    const target = await repo.getWorldBySlug("zweitziel");
    assert.ok(target);
    await repo.createPage({
      worldId: target.id,
      title: "Die Hohe Wiese",
      slug: "die-hohe-wiese",
      type: "region",
    });

    const source = await repo.listPagesByWorld("steinbruch");
    const region = source.find((page) => page.slug === "die-hohe-wiese");
    assert.ok(region);

    const result = await transferPagesToWorld(repo, {
      sourceWorldSlug: "steinbruch",
      targetWorldSlug: "zweitziel",
      pageIds: [region.id],
      includeDescendants: false,
      confirmed: true,
    });

    assert.equal(result.pages[0]?.slug, "die-hohe-wiese-2");
  });

  it("refuses to copy a world onto itself and refuses without confirmation", async () => {
    const repo = createUweRepository(databaseUrl);

    await assert.rejects(
      () =>
        transferPagesToWorld(repo, {
          sourceWorldSlug: "steinbruch",
          targetWorldSlug: "steinbruch",
          pageIds: [],
          confirmed: true,
        }),
      /dieselbe/,
    );

    await assert.rejects(
      () =>
        transferPagesToWorld(repo, {
          sourceWorldSlug: "steinbruch",
          targetWorldSlug: "terra-ziel",
          pageIds: [],
          confirmed: false,
        }),
      /confirmed/,
    );
  });
});
