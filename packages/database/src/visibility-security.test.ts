import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { PAGE_TEMPLATES } from "./page-templates";
import { createPageTemplateService } from "./page-template-service";
import {
  PORTAL_BLOCK_VISIBILITIES,
  PORTAL_PAGE_VISIBILITIES,
} from "./permissions";
import { buildPageView } from "./page-service";
import { createUweRepository, type UweRepository } from "./repository";
import { createShareLinkService } from "./share-link-service";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Hard security guarantees for the visibility system:
 *
 * - dm_only content must NEVER be readable through portal contexts
 *   (the no-login /worlds/* routes of the player portal).
 * - player_visible content appears there exactly when published.
 * - Templates never pre-fill portal-visible GM secrets.
 *
 * Any failure here is a leak — treat as a hard error, never skip.
 */

describe("visibility security guarantees", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let worldId: string;
  const worldSlug = "vis-sec-test";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);

    const world = await repo.createWorld({
      name: "Visibility Security Test",
      slug: worldSlug,
    });
    worldId = world.id;

    await repo.createPage({
      worldId,
      title: "Geheimplan",
      slug: "geheimplan",
      type: "lore",
      visibility: "dm_only",
      publishStatus: "published",
      contentBlocks: [
        { type: "rich_text", sortOrder: 0, visibility: "dm_only", content: "STRENG GEHEIM" },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Marktplatz",
      slug: "marktplatz",
      type: "location",
      visibility: "player_visible",
      publishStatus: "published",
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
          content: "GEHEIM: Taschendieb-Gilde",
        },
      ],
    });

    await repo.createPage({
      worldId,
      title: "Unfertiger Ort",
      slug: "unfertiger-ort",
      type: "location",
      visibility: "player_visible",
      publishStatus: "draft",
    });
  });

  it("never exposes dm_only visibilities through the portal allow-lists", () => {
    assert.ok(!PORTAL_PAGE_VISIBILITIES.includes("dm_only"));
    assert.ok(!PORTAL_BLOCK_VISIBILITIES.includes("dm_only"));
    assert.ok(!PORTAL_PAGE_VISIBILITIES.includes("archived"));
    assert.ok(!PORTAL_BLOCK_VISIBILITIES.includes("archived"));
  });

  it("hides dm_only pages from portal page listings (/worlds/*)", async () => {
    const portalPages = await repo.listPagesForContext(worldSlug, "portal");
    const titles = portalPages.map((page) => page.title);

    assert.ok(!titles.includes("Geheimplan"), "dm_only page leaked into portal listing!");
    assert.ok(titles.includes("Marktplatz"));
  });

  it("refuses to serve dm_only pages through the portal page endpoint", async () => {
    assert.equal(await repo.getPublicPageForPortal(worldSlug, "geheimplan"), null);
  });

  it("serves published player_visible pages without login and filters dm_only blocks", async () => {
    const page = await repo.getPublicPageForPortal(worldSlug, "marktplatz");
    assert.ok(page, "player_visible published page must be served");

    const contents = page.contentBlocks.map((block) => block.content).join("\n");
    assert.ok(contents.includes("Belebter Markt."));
    assert.ok(!contents.includes("GEHEIM"), "dm_only block leaked into portal page!");
    assert.ok(
      page.contentBlocks.every((block) => block.visibility !== "dm_only"),
      "dm_only block visibility leaked into portal page!",
    );
  });

  it("hides player_visible drafts from the portal until published", async () => {
    assert.equal(await repo.getPublicPageForPortal(worldSlug, "unfertiger-ort"), null);

    const portalPages = await repo.listPagesForContext(worldSlug, "portal");
    assert.ok(!portalPages.some((page) => page.title === "Unfertiger Ort"));
  });

  it("keeps the DM context complete (no accidental filtering in Studio)", async () => {
    const dmPages = await repo.listPagesForContext(worldSlug, "dm");
    const titles = dmPages.map((page) => page.title);
    assert.ok(titles.includes("Geheimplan"));
    assert.ok(titles.includes("Marktplatz"));
    assert.ok(titles.includes("Unfertiger Ort"));
  });

  it("never exposes dm_only blocks through share links by default", async () => {
    const marktplatz = await repo.getPageBySlug(worldSlug, "marktplatz");
    assert.ok(marktplatz);

    const shareService = createShareLinkService(db);
    const link = await shareService.createShareLink({
      worldId,
      targetType: "page",
      targetId: marktplatz.id,
    });

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);

    const view = await buildPageView(repo, worldSlug, "marktplatz", "share", {
      shareGrant: access.grant,
      shareToken: link.token,
    });

    assert.ok(view);
    const contents = view.page.content;
    assert.ok(contents.includes("Belebter Markt."));
    assert.ok(!contents.includes("GEHEIM"), "dm_only block leaked into share view!");
  });

  it("code-defined templates keep GM secrets in dm_only blocks", () => {
    for (const template of PAGE_TEMPLATES) {
      for (const block of template.blocks) {
        if (block.type === "gm_note") {
          assert.equal(
            block.visibility,
            "dm_only",
            `Template ${template.id}: gm_note block must be dm_only`,
          );
        }
      }
    }
  });

  it("seeded DB templates keep GM secrets in dm_only blocks", async () => {
    const templates = await createPageTemplateService(db).listTemplates({
      includeInactive: true,
    });
    assert.ok(templates.length >= PAGE_TEMPLATES.length);

    for (const template of templates) {
      for (const block of template.blocks) {
        if (block.type === "gm_note") {
          assert.equal(
            block.visibility,
            "dm_only",
            `DB-Template ${template.slug}: gm_note block must be dm_only`,
          );
        }
      }
    }
  });

  it("session template stays fully dm_only", async () => {
    const template = await createPageTemplateService(db).getTemplate("session");
    assert.ok(template);
    assert.equal(template.defaultVisibility, "dm_only");
    assert.ok(template.blocks.every((block) => block.visibility === "dm_only"));
  });
});
