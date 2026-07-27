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
    await auth.setWorldGuestMode(world.id, true);

    const users = await seedAuthUsers(auth, repo, world.id);
    dmUserId = users.dm.id;
    amanUserId = users.players.find((p) => p.displayName === "Aman")!.id;
    lazulUserId = users.players.find((p) => p.displayName === "Lazul")!.id;

    // A matrix that exercises every branch of canViewPage: one page per
    // visibility value.
    const pages = [
      { slug: "pub-page", visibility: "public" },
      { slug: "pv-page", visibility: "player_visible" },
      { slug: "dmonly-page", visibility: "dm_only" },
      { slug: "private-page", visibility: "private" },
      { slug: "archived-page", visibility: "archived" },
      { slug: "specific-page", visibility: "specific_players" },
      { slug: "unlock-page", visibility: "unlock_after_session" },
    ] as const;

    for (const page of pages) {
      await repo.createPage({
        worldId: world.id,
        title: page.slug,
        slug: page.slug,
        type: "note",
        visibility: page.visibility,
      });
    }

    // Aman is granted the specific-players page and has unlocked the unlock page.
    const specific = await db.page.findFirstOrThrow({
      where: { world: { slug: worldSlug }, slug: "specific-page" },
    });
    const unlock = await db.page.findFirstOrThrow({
      where: { world: { slug: worldSlug }, slug: "unlock-page" },
    });
    await auth.grantPagePlayerAccess(specific.id, amanUserId);
    await auth.unlockPageForUser(unlock.id, amanUserId, "Session 1");
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

  it("granted player result equals the baseline and only exposes allowed pages", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: amanUserId });
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "player");
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
    assert.deepEqual(
      new Set(await narrowedSlugs(ctx)),
      new Set(["pub-page", "pv-page", "specific-page", "unlock-page"]),
    );
  });

  it("ungranted player result equals the baseline (specific/unlock stay hidden)", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: lazulUserId });
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "player");
    const narrowed = await narrowedSlugs(ctx);
    assert.deepEqual(narrowed, await baselineSlugs(ctx));
    assert.ok(!narrowed.includes("specific-page"));
    assert.ok(!narrowed.includes("unlock-page"));
    assert.ok(!narrowed.includes("dmonly-page"));
  });

  it("DM preview-as-player result equals the baseline (non-staff narrowing)", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, {
      userId: dmUserId,
      preview: { previewAsUserId: amanUserId },
    });
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "player");
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
  });

  it("guest result equals the baseline", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "guest");
    assert.deepEqual(await narrowedSlugs(ctx), await baselineSlugs(ctx));
  });
});
