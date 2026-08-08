import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { SecurityTestRole } from "./markers";
import { SECURITY_MARKERS } from "./markers";
import { createSecurityFixture, type SecurityFixture } from "./fixtures/security-fixture";

type PageExpectation = "visible" | "hidden";
type BlockExpectation = "all" | "none";

/**
 * Access matrix after page-level Portal release was introduced.
 *
 * World assignment opens the world. `portalReleased` then controls which whole
 * pages a player may discover, while the Studio checkbox also permits
 * unreleased pages. Anonymous visitors receive no world content.
 *
 * The Studio checkbox additionally preserves `:::dm` sections inside released
 * page text. These two gates must agree across lists, direct views, search and
 * wikilink resolution.
 */
interface RoleExpectations {
  publicPage: PageExpectation;
  playerVisiblePage: PageExpectation;
  playerVisibleBlocks: BlockExpectation;
  /**
   * Der DM-Bereich mitten im Block (`:::dm … :::`). Die einzige Abstufung, die
   * die Welt-Zuordnung NICHT mitbringt — dafür braucht es das Studio-Häkchen.
   */
  dmSection: PageExpectation;
  dmOnlyPage: PageExpectation;
  hiddenSecretPage: PageExpectation;
  revealedSecretPage: PageExpectation;
  publicMedia: PageExpectation;
  privateMedia: PageExpectation;
  privateWorldDmPage: PageExpectation;
}

const ANONYMOUS: RoleExpectations = {
  publicPage: "hidden",
  playerVisiblePage: "hidden",
  playerVisibleBlocks: "none",
  dmSection: "hidden",
  dmOnlyPage: "hidden",
  hiddenSecretPage: "hidden",
  revealedSecretPage: "hidden",
  publicMedia: "hidden",
  privateMedia: "hidden",
  privateWorldDmPage: "hidden",
};

/** Assigned to the public world, not to the private one. */
const WORLD_MEMBER: RoleExpectations = {
  publicPage: "visible",
  playerVisiblePage: "visible",
  playerVisibleBlocks: "all",
  // Zugeordnet sein reicht für alles — außer für den DM-Bereich im Text und
  // für Seiten ohne Portal-Freigabe.
  dmSection: "hidden",
  dmOnlyPage: "hidden",
  hiddenSecretPage: "visible",
  revealedSecretPage: "visible",
  publicMedia: "visible",
  privateMedia: "visible",
  privateWorldDmPage: "hidden",
};

/** Staff reads every world — und als einzige den DM-Bereich im Wikitext. */
const STAFF: RoleExpectations = {
  ...WORLD_MEMBER,
  dmSection: "visible",
  // Das Studio-Häkchen sieht auch, was nicht freigegeben ist.
  dmOnlyPage: "visible",
  privateWorldDmPage: "visible",
};

const ROLE_MATRIX: Record<SecurityTestRole, RoleExpectations> = {
  anonymous: ANONYMOUS,
  player: WORLD_MEMBER,
  dm: STAFF,
  admin: STAFF,
  owner: STAFF,
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

      it("returns all blocks of a page the viewer may read", async () => {
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
        } else {
          assert.equal(page.contentBlocks.length, 0);
        }

        // Derselbe Block trägt einen DM-Bereich. Er fällt nicht mit dem Block
        // weg, sondern aus ihm heraus — der Vorlesetext bleibt.
        if (expectations.dmSection === "visible") {
          assert.ok(
            contents.includes(SECURITY_MARKERS.DM_SECTION),
            `${role} should read the DM section`,
          );
        } else {
          assert.ok(
            !contents.includes(SECURITY_MARKERS.DM_SECTION),
            `${role} must not read the DM section`,
          );
          assert.ok(!contents.includes(":::"), `${role} must not even see the markers`);
        }
      });

      it("controls asset access by world assignment", async () => {
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

      it("applies the page release gate to search and wikilink resolution", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(
          fixture.content.publicWorldSlug,
          { userId },
        );
        assert.ok(ctx);

        const searchResults = await fixture.auth.searchForViewer(
          fixture.content.publicWorldSlug,
          ctx!,
          { query: SECURITY_MARKERS.DM_ONLY },
        );
        const findsUnreleasedPage = searchResults.some(
          (result) => result.slug === fixture.content.slugs.dmOnlyPage,
        );

        const html = await fixture.auth.renderBlockContentForViewer(
          fixture.content.publicWorldSlug,
          "[[Nur DM]]",
          ctx!,
        );
        const resolvesUnreleasedPage = html.includes(
          `/auth/worlds/${fixture.content.publicWorldSlug}/${fixture.content.slugs.dmOnlyPage}`,
        );

        const expected = expectations.dmOnlyPage === "visible";
        assert.equal(findsUnreleasedPage, expected);
        assert.equal(resolvesUnreleasedPage, expected);
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

});
