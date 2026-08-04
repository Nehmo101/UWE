import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { buildWorldGraphForViewer } from "@uwe/database/graph-service";
import { exportWorldWiki } from "@uwe/static-export";
import type { SecurityTestRole } from "./markers";
import { SECURITY_MARKERS } from "./markers";
import { createSecurityFixture, type SecurityFixture } from "./fixtures/security-fixture";

type PageExpectation = "visible" | "hidden";
type BlockExpectation = "all" | "none";

/**
 * The access matrix after visibility was removed (Notiz Lasse, 2026-07-26).
 *
 * There is exactly one content rule left: whoever is assigned to a world sees
 * everything in it. So the matrix distinguishes three things — whether the
 * viewer is signed in at all, whether they belong to the world, and whether
 * they hold the Studio checkbox. An anonymous visitor gets nothing even in a
 * guest-mode world; a player gets the full public world but nothing from the
 * private world they are not in.
 *
 * Das Studio-Häkchen entscheidet nur noch über eine einzige Sache am Inhalt:
 * den DM-Bereich mitten im Wikitext (`:::dm … :::`). Ganze Seiten, Blöcke und
 * Bilder kennen keine Abstufung mehr.
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

      it("search never returns unreleased pages — and keeps released ones", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        // Über den Titel UND über den Inhalt suchen: Beide Wege verrieten
        // sonst Existenz bzw. Wortlaut einer gesperrten Seite im Snippet.
        for (const query of ["Nur DM", SECURITY_MARKERS.DM_ONLY]) {
          const results = await fixture.auth.searchForViewer(
            fixture.content.publicWorldSlug,
            ctx!,
            { query },
          );
          const hit = results.find((item) => item.slug === fixture.content.slugs.dmOnlyPage);
          if (expectations.dmOnlyPage === "visible") {
            assert.ok(hit, `${role} should find the unreleased page via "${query}"`);
          } else {
            assert.equal(
              hit,
              undefined,
              `${role} must not find the unreleased page via "${query}"`,
            );
          }
        }

        // Gegenprobe gegen Über-Filterung: Die freigegebene Seite bleibt
        // auffindbar (fällt weg, wenn ein Select `portalReleased` vergisst).
        const released = await fixture.auth.searchForViewer(
          fixture.content.publicWorldSlug,
          ctx!,
          { query: "Spieler sichtbar" },
        );
        const releasedHit = released.find(
          (item) => item.slug === fixture.content.slugs.playerVisiblePage,
        );
        if (expectations.playerVisiblePage === "visible") {
          assert.ok(releasedHit, `${role} should still find the released page`);
        } else {
          assert.equal(releasedHit, undefined);
        }
      });

      it("world graph contains only released pages", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const graph = await buildWorldGraphForViewer(
          fixture.repo,
          fixture.content.publicWorldSlug,
          ctx!,
        );
        const ids = new Set(graph.nodes.map((node) => node.id));

        if (expectations.dmOnlyPage === "visible") {
          assert.ok(ids.has(fixture.content.pageIds.dmOnlyPage));
        } else {
          assert.ok(
            !ids.has(fixture.content.pageIds.dmOnlyPage),
            `${role} must not see the unreleased page in the graph`,
          );
        }
        if (expectations.publicPage === "visible") {
          assert.ok(
            ids.has(fixture.content.pageIds.publicPage),
            `${role} should keep the released page in the graph`,
          );
        }
      });

      it("timeline events keep released linked pages and drop unreleased ones", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const events = await fixture.auth.listWorldEventsForViewer(
          fixture.content.publicWorldSlug,
          ctx!,
        );

        if (expectations.publicPage === "hidden") {
          assert.equal(events.length, 0, `${role} must not see world events`);
          return;
        }

        const event = events.find((item) => item.title.startsWith("Chronik:"));
        assert.ok(event, `${role} should see the world event`);
        const linkedIds = new Set(event!.linkedPages.map((page) => page.id));

        // Fängt die Über-Filterung (A4): Vergisst ein Select `portalReleased`,
        // wirft der fail-closed Guard auch die FREIGEGEBENE Seite hinaus.
        assert.ok(
          linkedIds.has(fixture.content.pageIds.publicPage),
          `${role} should see the released linked page`,
        );
        if (expectations.dmOnlyPage === "visible") {
          assert.ok(linkedIds.has(fixture.content.pageIds.dmOnlyPage));
        } else {
          assert.ok(
            !linkedIds.has(fixture.content.pageIds.dmOnlyPage),
            `${role} must not see the unreleased linked page`,
          );
        }
      });

      it("portal dashboard never mentions unreleased pages", async () => {
        const userId = userIdForRole(fixture, role);
        const ctx = await fixture.auth.buildAccessContextForWorld(fixture.content.publicWorldSlug, {
          userId,
        });
        assert.ok(ctx);

        const dashboard = await fixture.auth.getPortalDashboard(
          fixture.content.publicWorldSlug,
          ctx!,
        );
        const serialized = JSON.stringify(dashboard ?? {});

        if (expectations.dmOnlyPage === "hidden") {
          assert.ok(
            !serialized.includes(fixture.content.slugs.dmOnlyPage),
            `${role} dashboard must not mention the unreleased slug`,
          );
          assert.ok(
            !serialized.includes(SECURITY_MARKERS.DM_ONLY),
            `${role} dashboard must not leak unreleased content`,
          );
        }
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

  // Der statische Wiki-Export hat keine Rolle: Er ist immer die Spielersicht
  // in Dateiform (siehe `staticExportViewerContext`). Deshalb ein einzelner
  // Durchlauf statt einer Matrix-Zeile.
  describe("static wiki export", () => {
    it("exports only released pages, without DM sections", async () => {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "uwe-sec-export-"));
      try {
        const result = await exportWorldWiki(fixture.repo, {
          worldSlug: fixture.content.publicWorldSlug,
          outputDir,
          format: "markdown",
        });

        assert.ok(
          result.files.includes(`${fixture.content.slugs.playerVisiblePage}.md`),
          "released page should be exported",
        );
        assert.ok(
          !result.files.includes(`${fixture.content.slugs.dmOnlyPage}.md`),
          "unreleased page must not be exported",
        );

        for (const file of result.files) {
          const content = fs.readFileSync(path.join(outputDir, file), "utf8");
          assert.ok(
            !content.includes(SECURITY_MARKERS.DM_ONLY),
            `${file} must not contain unreleased content`,
          );
          assert.ok(
            !content.includes(SECURITY_MARKERS.DM_SECTION),
            `${file} must not contain DM section text`,
          );
          if (file.endsWith(".json")) {
            assert.ok(
              !content.includes(fixture.content.slugs.dmOnlyPage),
              `${file} must not reference the unreleased slug`,
            );
          }
        }
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});
