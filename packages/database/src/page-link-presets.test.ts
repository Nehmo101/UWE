import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository } from "./repository";
import {
  PAGE_LINK_RELATION_LABELS,
  PAGE_LINK_RELATION_PRESETS,
  isPageLinkRelationPreset,
  pageLinkRelationLabel,
} from "./page-link-presets";

describe("page-link-presets", () => {
  it("exposes German labels for all presets", () => {
    for (const preset of PAGE_LINK_RELATION_PRESETS) {
      assert.ok(PAGE_LINK_RELATION_LABELS[preset], `missing label for ${preset}`);
      assert.ok(isPageLinkRelationPreset(preset));
    }
    assert.equal(isPageLinkRelationPreset("unknown"), false);
    assert.equal(pageLinkRelationLabel("contains"), "Enthält");
    assert.equal(pageLinkRelationLabel("custom_type"), "custom_type");
  });
});

describe("page links repository", () => {
  let databaseUrl: string;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
  });

  after(async () => {
    const { createPrismaClient } = await import("./client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("lists, updates, and deletes page links for a page", async () => {
    const repo = createUweRepository(databaseUrl);
    const world = await repo.createWorld({
      name: "Link Test",
      slug: "link-test",
      description: "Page link tests",
    });

    const source = await repo.createPage({
      worldId: world.id,
      title: "Validori",
      slug: "validori",
      type: "location",
      visibility: "dm_only",
      contentBlocks: [],
    });

    const target = await repo.createPage({
      worldId: world.id,
      title: "Turm",
      slug: "turm",
      type: "location",
      visibility: "dm_only",
      contentBlocks: [],
    });

    const link = await repo.createPageLink({
      sourcePageId: source.id,
      targetPageId: target.id,
      relationType: "contains",
      label: "Validori enthält den Turm",
    });

    const listed = await repo.listPageLinksForPage(source.id);
    assert.equal(listed.outgoing.length, 1);
    assert.equal(listed.incoming.length, 0);
    assert.equal(listed.outgoing[0]?.targetPage.slug, "turm");

    const incoming = await repo.listPageLinksForPage(target.id);
    assert.equal(incoming.incoming.length, 1);
    assert.equal(incoming.incoming[0]?.sourcePage.slug, "validori");

    await repo.updatePageLink(link.id, {
      relationType: "controls",
      label: null,
    });

    const updated = await repo.listPageLinksForPage(source.id);
    assert.equal(updated.outgoing[0]?.relationType, "controls");
    assert.equal(updated.outgoing[0]?.label, null);

    await repo.deletePageLink(link.id);
    const afterDelete = await repo.listPageLinksForPage(source.id);
    assert.equal(afterDelete.outgoing.length, 0);
  });
});
