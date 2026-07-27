import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { SecurityTestRole } from "./markers";
import { SECURITY_MARKERS } from "./markers";
import { createSecurityFixture, type SecurityFixture } from "./fixtures/security-fixture";

type PageExpectation = "visible" | "hidden";
type BlockExpectation = "all" | "player_only" | "none";

interface RoleExpectations {
  publicPage: PageExpectation;
  playerVisiblePage: PageExpectation;
  playerVisibleBlocks: BlockExpectation;
  dmOnlyPage: PageExpectation;
  hiddenSecretPage: PageExpectation;
  revealedSecretPage: PageExpectation;
  publicMedia: PageExpectation;
  privateMedia: PageExpectation;
  privateWorldDmPage: PageExpectation;
}

const ROLE_MATRIX: Record<SecurityTestRole, RoleExpectations> = {
  anonymous: {
    publicPage: "hidden",
    playerVisiblePage: "hidden",
    playerVisibleBlocks: "none",
    dmOnlyPage: "hidden",
    hiddenSecretPage: "hidden",
    revealedSecretPage: "hidden",
    publicMedia: "hidden",
    privateMedia: "hidden",
    privateWorldDmPage: "hidden",
  },
  player: {
    publicPage: "visible",
    playerVisiblePage: "visible",
    playerVisibleBlocks: "player_only",
    dmOnlyPage: "hidden",
    hiddenSecretPage: "hidden",
    revealedSecretPage: "visible",
    publicMedia: "visible",
    privateMedia: "hidden",
    privateWorldDmPage: "hidden",
  },
  dm: {
    publicPage: "visible",
    playerVisiblePage: "visible",
    playerVisibleBlocks: "all",
    dmOnlyPage: "visible",
    hiddenSecretPage: "visible",
    revealedSecretPage: "visible",
    publicMedia: "visible",
    privateMedia: "visible",
    privateWorldDmPage: "visible",
  },
  admin: {
    publicPage: "visible",
    playerVisiblePage: "visible",
    playerVisibleBlocks: "all",
    dmOnlyPage: "visible",
    hiddenSecretPage: "visible",
    revealedSecretPage: "visible",
    publicMedia: "visible",
    privateMedia: "visible",
    privateWorldDmPage: "visible",
  },
  owner: {
    publicPage: "visible",
    playerVisiblePage: "visible",
    playerVisibleBlocks: "all",
    dmOnlyPage: "visible",
    hiddenSecretPage: "visible",
    revealedSecretPage: "visible",
    publicMedia: "visible",
    privateMedia: "visible",
    privateWorldDmPage: "visible",
  },
};

function userIdForRole(fixture: SecurityFixture, role: SecurityTestRole): string | undefined {
  switch (role) {
    case "anonymous":
      return undefined;
    case "player":
      return fixture.users.player.id;
    case "dm":
      return fixture.users.dm.id;
    case "admin":
      return fixture.users.admin.id;
    case "owner":
      return fixture.users.owner.id;
  }
}

describe("security role matrix", () => {
  let fixture: SecurityFixture;

  before(async () => {
    fixture = await createSecurityFixture();
  });

  after(async () => {
    await fixture.cleanup();
  });

  for (const [role, expectations] of Object.entries(ROLE_MATRIX) as Array<
    [SecurityTestRole, RoleExpectations]
  >) {
    describe(role, () => {
      it("lists only allowed pages on the public world", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx, `missing access context for ${role}`);

        const pages = await fixture.auth.listPagesForViewer(fixture.content.publicWorldSlug, ctx!);
        const slugs = new Set(pages.map((page) => page.slug));

        const assertPage = (slug: string, expected: PageExpectation) => {
          if (expected === "visible") {
            assert.ok(slugs.has(slug), `${role} should see ${slug}`);
          } else {
            assert.ok(!slugs.has(slug), `${role} must not see ${slug}`);
          }
        };

        assertPage(fixture.content.slugs.publicPage, expectations.publicPage);
        assertPage(fixture.content.slugs.playerVisiblePage, expectations.playerVisiblePage);
        assertPage(fixture.content.slugs.dmOnlyPage, expectations.dmOnlyPage);
        assertPage(fixture.content.slugs.hiddenSecretPage, expectations.hiddenSecretPage);
        assertPage(fixture.content.slugs.revealedSecretPage, expectations.revealedSecretPage);
      });

      it("respects block-level visibility on player_visible pages", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const page = await fixture.auth.getPageForViewer(
          fixture.content.publicWorldSlug,
          fixture.content.slugs.playerVisiblePage,
          ctx!,
        );

        if (expectations.playerVisiblePage === "hidden") {
          assert.equal(page, null);
          return;
        }

        assert.ok(page);
        const contents = page.contentBlocks.map((block) => block.content).join("\n");

        if (expectations.playerVisibleBlocks === "all") {
          assert.ok(contents.includes(SECURITY_MARKERS.PLAYER_VISIBLE));
          assert.ok(contents.includes(SECURITY_MARKERS.DM_ONLY));
        } else if (expectations.playerVisibleBlocks === "player_only") {
          assert.ok(contents.includes(SECURITY_MARKERS.PLAYER_VISIBLE));
          assert.ok(!contents.includes(SECURITY_MARKERS.DM_ONLY));
        } else {
          assert.equal(page.contentBlocks.length, 0);
        }
      });

      it("controls asset visibility", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const assets = await fixture.auth.listAssetsForViewer(fixture.content.publicWorldSlug, ctx!);
        const ids = new Set(assets.map((asset) => asset.id));

        const assertAsset = (id: string, expected: PageExpectation) => {
          if (expected === "visible") {
            assert.ok(ids.has(id), `${role} should see asset ${id}`);
          } else {
            assert.ok(!ids.has(id), `${role} must not see asset ${id}`);
          }
        };

        assertAsset(fixture.content.assetIds.publicMedia, expectations.publicMedia);
        assertAsset(fixture.content.assetIds.privateMedia, expectations.privateMedia);
      });

      it("scopes private world content by role", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.privateWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const page = await fixture.auth.getPageForViewer(
          fixture.content.privateWorldSlug,
          "private-dm-only",
          ctx!,
        );

        if (expectations.privateWorldDmPage === "visible") {
          assert.ok(page);
        } else {
          assert.equal(page, null);
        }
      });
    });
  }

  it("anonymous portal context never serves dm_only pages", async () => {
    const page = await fixture.repo.getPublicPageForPortal(
      fixture.content.publicWorldSlug,
      fixture.content.slugs.dmOnlyPage,
    );
    assert.equal(page, null);
  });
});
