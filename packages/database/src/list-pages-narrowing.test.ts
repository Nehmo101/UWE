import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AccessContext } from "@uwe/auth";
import { filterPagesForViewer } from "@uwe/auth";
import { createAuthService, type AuthService } from "./auth";
import { seedAuthUsers } from "./auth-seed";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository, type UweRepository } from "./repository";

/**
 * WS3 safety net: `listPagesForViewer` pre-narrows the SQL for non-staff
 * viewers (visibility) and then still runs `filterPagesForViewer`
 * in JS as the authoritative gate. This suite proves the SQL pre-narrowing is a
 * behaviour-preserving optimisation: for every viewer, the returned set is
 * byte-for-byte the same as a plain `findMany`-then-`filterPagesForViewer`
 * baseline (i.e. the pre-optimisation behaviour). Any divergence hides visible
 * content or leaks hidden content, so it must fail loudly.
 */
describe("listPagesForViewer SQL pre-narrowing equivalence", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let db: ReturnType<typeof createPrismaClient>;
  let auth: AuthService;
  let repo: UweRepository;

  let dmUserId: string;
  let amanUserId: string;
  let lazulUserId: string;

  // Baseline = the exact pre-WS3 behaviour: load every page of the world with
  // no where-narrowing and no select, then apply the authoritative JS filter.
  async function baselineSlugs(ctx: AccessContext): Promise<string[]> {
    const pages = await db.page.findMany({
      where: { world: { slug: worldSlug } },
      orderBy: [{ title: "asc" }],
    });
    return filterPagesForViewer(ctx, pages).map((page) => page.slug);
  }

  async function narrowedSlugs(ctx: AccessContext): Promise<string[]> {
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    return pages.map((page) => page.slug);
  }

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Narrowing Test World",
      slug: "narrowing-test",
      description: "listPagesForViewer narrowing equivalence",
    });
    worldSlug = world.slug;

    const users = await seedAuthUsers(auth, repo, world.id);
    dmUserId = users.dm.id;
    amanUserId = users.players.find((p) => p.displayName === "Aman")!.id;
    lazulUserId = users.players.find((p) => p.displayName === "Lazul")!.id;

    // A matrix that exercises both branches of the portal-release gate (#85):
    // released pages reach players, unreleased ones stay staff-only.
    const pages = [
      { slug: "pub-page", portalReleased: true },
      { slug: "pv-page", portalReleased: true },
      { slug: "dmonly-page", portalReleased: false },
      { slug: "private-page", portalReleased: false },
      { slug: "archived-page", portalReleased: false },
      { slug: "specific-page", portalReleased: true },
      { slug: "unlock-page", portalReleased: true },
    ] as const;

    for (const page of pages) {
      await repo.createPage({
        worldId: world.id,
        title: page.slug,
        slug: page.slug,
        type: "note",
        portalReleased: page.portalReleased,
      });
    }

    // Aman is granted the specific-players page and has unlocked the unlock page.
  });

  after(async () => {
    await db.$disconnect();
  });

  it("DM/owner (staff) result equals the unfiltered-then-JS-filter baseline", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(ctx);
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
    // Staff must see the full world, including archived and private pages.
    assert.deepEqual(
      new Set(await narrowedSlugs(ctx)),
      new Set([
        "pub-page",
        "pv-page",
        "dmonly-page",
        "private-page",
        "archived-page",
        "specific-page",
        "unlock-page",
      ]),
    );
  });

  it("an assigned player sees exactly the released pages, same as the baseline", async () => {
    for (const userId of [amanUserId, lazulUserId]) {
      const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId });
      assert.ok(ctx);
      assert.equal(ctx.user?.access.studio, false);
      assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
      assert.deepEqual(
        new Set(await narrowedSlugs(ctx)),
        new Set(["pub-page", "pv-page", "specific-page", "unlock-page"]),
      );
    }
  });

  it("DM preview-as-player result equals the baseline (non-staff narrowing)", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: dmUserId,
      preview: { previewAsUserId: amanUserId },
    });
    assert.ok(ctx);
    assert.equal(ctx.previewAsUserId, amanUserId);
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
  });

  it("anonymous result equals the baseline — an anonymous visitor gets nothing", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);
    assert.equal(ctx.user, null);
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
    assert.deepEqual(await narrowedSlugs(ctx), []);
  });
});
