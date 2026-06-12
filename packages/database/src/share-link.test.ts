import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "./client";
import { createPage, createWorld, createUweRepository } from "./repository";
import { buildPageView } from "./page-service";
import {
  createShareLinkService,
  isShareLinkActive,
  type ShareLinkService,
} from "./share-link-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("ShareLinkService", () => {
  let databaseUrl: string;
  let shareService: ShareLinkService;

  before(() => {
    databaseUrl = createTestDatabaseUrl();
    shareService = createShareLinkService(createPrismaClient(databaseUrl));
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  async function seedSharedPage(suffix: string) {
    const world = await createWorld(
      { name: `Share Test ${suffix}`, slug: `share-test-${suffix}`, description: "Test" },
      databaseUrl,
    );

    const page = await createPage(
      {
        worldId: world.id,
        title: `Geheime Festung ${suffix}`,
        slug: `festung-${suffix}`,
        type: "location",
        visibility: "dm_only",
        publishStatus: "draft",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "player_visible",
            content: "Spieler sichtbarer Text über die Festung.",
          },
          {
            type: "gm_note",
            sortOrder: 1,
            visibility: "dm_only",
            content: "Geheime Fallen und NPCs.",
          },
        ],
      },
      databaseUrl,
    );

    const link = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: page.id,
    });

    return { world, page, link };
  }

  it("shows allowed content via share link", async () => {
    const { world, page, link } = await seedSharedPage("content");
    const repo = createUweRepository(databaseUrl);

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);
    assert.equal(access.target.kind, "page");

    const view = await buildPageView(repo, world.slug, page.slug, "share", {
      shareGrant: access.grant,
      shareToken: link.token,
    });

    assert.ok(view);
    assert.equal(view.page.title, page.title);
    assert.match(view.html, /Spieler sichtbarer Text/);
  });

  it("exposes dm_only blocks on an explicitly shared page", async () => {
    const { world, page, link } = await seedSharedPage("blocks");
    const repo = createUweRepository(databaseUrl);

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);

    const view = await buildPageView(repo, world.slug, page.slug, "share", {
      shareGrant: access!.grant,
      shareToken: link.token,
    });

    assert.ok(view);
    assert.match(view.html, /Geheime Fallen/);
    assert.equal(view.page.content.includes("Geheime Fallen"), true);
  });

  it("exposes dm_only page content via filterPageForShare", async () => {
    const { link } = await seedSharedPage("filter");
    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);
    assert.equal(access.target.kind, "page");

    const filtered = shareService.filterPageForShare(access.target.page, access.grant);
    assert.ok(filtered);
    assert.equal(filtered.contentBlocks.length, 2);
    assert.ok(filtered.contentBlocks.some((block) => block.visibility === "dm_only"));
  });

  it("rejects disabled share links", async () => {
    const { link } = await seedSharedPage("disabled");
    await shareService.disableShareLink(link.id);

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.equal(access, null);
    assert.equal(isShareLinkActive({ ...link, enabled: false }), false);
  });

  it("rejects expired share links", async () => {
    const world = await createWorld(
      { name: "Expired", slug: "expired-world", description: "Test" },
      databaseUrl,
    );
    const page = await createPage(
      {
        worldId: world.id,
        title: "Alt",
        slug: "alt",
        type: "note",
        contentBlocks: [
          { type: "rich_text", sortOrder: 0, visibility: "public", content: "Alt." },
        ],
      },
      databaseUrl,
    );

    const expiredLink = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: page.id,
      expiresAt: new Date(Date.now() - 60_000),
    });

    assert.equal(isShareLinkActive(expiredLink), false);

    const access = await shareService.validateShareAccess(expiredLink.token, {
      passwordVerified: true,
    });
    assert.equal(access, null);
  });

  it("enforces password protection", async () => {
    const world = await createWorld(
      { name: "Protected", slug: "protected-world", description: "Test" },
      databaseUrl,
    );
    const page = await createPage(
      {
        worldId: world.id,
        title: "Vault",
        slug: "vault",
        type: "secret",
        contentBlocks: [
          { type: "rich_text", sortOrder: 0, visibility: "public", content: "Vault content." },
        ],
      },
      databaseUrl,
    );

    const protectedLink = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: page.id,
      password: "geheim123",
    });

    const withoutPassword = await shareService.validateShareAccess(protectedLink.token);
    assert.equal(withoutPassword, null);

    const withWrongPassword = await shareService.validateShareAccess(protectedLink.token, {
      password: "falsch",
    });
    assert.equal(withWrongPassword, null);

    const withPassword = await shareService.validateShareAccess(protectedLink.token, {
      password: "geheim123",
    });
    assert.ok(withPassword);
  });

  it("hides dm_only link targets that are not explicitly shared", async () => {
    const world = await createWorld(
      { name: "Link Leak Test", slug: "link-leak-test", description: "Test" },
      databaseUrl,
    );

    const sharedPage = await createPage(
      {
        worldId: world.id,
        title: "Geteiltes Versteck",
        slug: "geteiltes-versteck",
        type: "secret",
        visibility: "dm_only",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "dm_only",
            content: "Fluchtweg nach [[Anderer Geheimort]].",
          },
        ],
      },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Anderer Geheimort",
        slug: "anderer-geheimort",
        type: "secret",
        visibility: "dm_only",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "dm_only",
            content: "Nur für den DM.",
          },
        ],
      },
      databaseUrl,
    );

    const link = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: sharedPage.id,
    });

    const repo = createUweRepository(databaseUrl);
    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);

    const view = await buildPageView(repo, world.slug, sharedPage.slug, "share", {
      shareGrant: access.grant,
      shareToken: link.token,
    });

    assert.ok(view);
    assert.match(view.html, /Fluchtweg/);
    assert.doesNotMatch(view.html, /Anderer Geheimort/);
    assert.doesNotMatch(view.html, /Nur für den DM/);

    const hiddenLink = view.links.find((item) => item.status === "hidden");
    assert.ok(hiddenLink);
    assert.equal(hiddenLink.displayText, "Verborgen");

    const otherView = await buildPageView(repo, world.slug, "anderer-geheimort", "share", {
      shareGrant: access.grant,
      shareToken: link.token,
    });
    assert.equal(otherView, null);
  });

  it("only shows backlinks for pages that are also shared", async () => {
    const world = await createWorld(
      { name: "Backlink Test", slug: "backlink-test", description: "Test" },
      databaseUrl,
    );

    const sharedPage = await createPage(
      {
        worldId: world.id,
        title: "Geteilt",
        slug: "geteilt",
        type: "location",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Siehe auch [[Geheim]].",
          },
        ],
      },
      databaseUrl,
    );

    await createPage(
      {
        worldId: world.id,
        title: "Geheim",
        slug: "geheim",
        type: "secret",
        visibility: "dm_only",
        contentBlocks: [
          {
            type: "rich_text",
            sortOrder: 0,
            visibility: "public",
            content: "Verweist auf [[Geteilt]].",
          },
        ],
      },
      databaseUrl,
    );

    const link = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: sharedPage.id,
    });

    const repo = createUweRepository(databaseUrl);
    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);

    const view = await buildPageView(repo, world.slug, "geteilt", "share", {
      shareGrant: access.grant,
      shareToken: link.token,
    });

    assert.ok(view);
    const hiddenLink = view.links.find((item) => item.status === "hidden");
    assert.ok(hiddenLink);
    assert.equal(hiddenLink.displayText, "Verborgen");
    assert.equal(view.backlinks.length, 0);
  });

  it("scopes a share token strictly to its own target", async () => {
    const world = await createWorld(
      { name: "Scope Test", slug: "scope-test", description: "Test" },
      databaseUrl,
    );

    const pageA = await createPage(
      {
        worldId: world.id,
        title: "Seite A",
        slug: "seite-a",
        type: "location",
        contentBlocks: [
          { type: "rich_text", sortOrder: 0, visibility: "public", content: "Inhalt A." },
        ],
      },
      databaseUrl,
    );

    const pageB = await createPage(
      {
        worldId: world.id,
        title: "Seite B — passwortgeschützt",
        slug: "seite-b",
        type: "secret",
        contentBlocks: [
          { type: "rich_text", sortOrder: 0, visibility: "public", content: "Inhalt B." },
        ],
      },
      databaseUrl,
    );

    const db = createPrismaClient(databaseUrl);
    const sharedAsset = await db.asset.create({
      data: {
        worldId: world.id,
        title: "Anderes Asset",
        type: "image",
        storageKey: "images/andere.png",
        mimeType: "image/png",
        visibility: "dm_only",
      },
    });

    const linkA = await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: pageA.id,
    });

    await shareService.createShareLink({
      worldId: world.id,
      targetType: "page",
      targetId: pageB.id,
      password: "geheim",
    });

    await shareService.createShareLink({
      worldId: world.id,
      targetType: "asset",
      targetId: sharedAsset.id,
    });

    const access = await shareService.validateShareAccess(linkA.token, { passwordVerified: true });
    assert.ok(access);

    // Token A must not unlock page B (shared via a different, protected link).
    assert.ok(access.grant.sharedPageIds.has(pageA.id));
    assert.equal(access.grant.sharedPageIds.has(pageB.id), false);
    assert.equal(access.grant.sharedAssetIds.has(sharedAsset.id), false);
    assert.equal(shareService.canAccessAssetViaShare(sharedAsset.id, access.grant), false);

    const repo = createUweRepository(databaseUrl);
    const crossView = await buildPageView(repo, world.slug, pageB.slug, "share", {
      shareGrant: access.grant,
      shareToken: linkA.token,
    });
    assert.equal(crossView, null);
  });

  it("allows share asset access only for the explicitly shared asset", async () => {
    const world = await createWorld(
      { name: "Asset Scope", slug: "asset-scope", description: "Test" },
      databaseUrl,
    );

    const db = createPrismaClient(databaseUrl);
    const sharedAsset = await db.asset.create({
      data: {
        worldId: world.id,
        title: "Geteiltes Bild",
        type: "image",
        storageKey: "images/shared.png",
        mimeType: "image/png",
        visibility: "dm_only",
      },
    });

    const otherAsset = await db.asset.create({
      data: {
        worldId: world.id,
        title: "Anderes Bild",
        type: "image",
        storageKey: "images/other.png",
        mimeType: "image/png",
        visibility: "dm_only",
      },
    });

    const link = await shareService.createShareLink({
      worldId: world.id,
      targetType: "asset",
      targetId: sharedAsset.id,
    });

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);
    assert.equal(access.target.kind, "asset");
    assert.equal(access.target.asset.id, sharedAsset.id);
    assert.equal(shareService.canAccessAssetViaShare(sharedAsset.id, access.grant), true);
    assert.equal(shareService.canAccessAssetViaShare(otherAsset.id, access.grant), false);
  });

  it("creates share links for handout assets", async () => {
    const world = await createWorld(
      { name: "Handout Test", slug: "handout-test", description: "Test" },
      databaseUrl,
    );

    const db = createPrismaClient(databaseUrl);
    const asset = await db.asset.create({
      data: {
        worldId: world.id,
        title: "Quest Handout",
        type: "handout",
        storageKey: "handouts/quest.pdf",
        mimeType: "application/pdf",
        visibility: "dm_only",
      },
    });

    const link = await shareService.createShareLink({
      worldId: world.id,
      targetType: "handout",
      targetId: asset.id,
    });

    const access = await shareService.validateShareAccess(link.token, { passwordVerified: true });
    assert.ok(access);
    assert.equal(access.target.kind, "asset");
    assert.equal(access.target.asset.id, asset.id);
  });
});
