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
 * viewers (publishStatus/visibility) and then still runs `filterPagesForViewer`
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

    // A matrix that exercises every branch of canViewPage: each visibility, each
    // publishStatus that is / isn't "published", and secret/reveal combinations.
    const pages = [
      { slug: "pub-published", visibility: "public", publishStatus: "published" },
      { slug: "pv-published", visibility: "player_visible", publishStatus: "published" },
      { slug: "dmonly-published", visibility: "dm_only", publishStatus: "published" },
      { slug: "private-published", visibility: "private", publishStatus: "published" },
      { slug: "archived-visibility", visibility: "archived", publishStatus: "published" },
      { slug: "pv-draft", visibility: "player_visible", publishStatus: "draft" },
      { slug: "pv-internal", visibility: "player_visible", publishStatus: "internal" },
      { slug: "pv-review", visibility: "player_visible", publishStatus: "review" },
      { slug: "pub-archived-status", visibility: "public", publishStatus: "archived" },
      { slug: "specific-published", visibility: "specific_players", publishStatus: "published" },
      { slug: "unlock-published", visibility: "unlock_after_session", publishStatus: "published" },
      {
        slug: "secret-hidden",
        visibility: "player_visible",
        publishStatus: "published",
        secretLevel: "dm_secret",
        revealState: "hidden",
      },
      {
        slug: "secret-revealed",
        visibility: "player_visible",
        publishStatus: "published",
        secretLevel: "dm_secret",
        revealState: "revealed",
      },
      {
        slug: "spoiler-preview",
        visibility: "public",
        publishStatus: "published",
        secretLevel: "spoiler",
        revealState: "preview",
      },
      {
        slug: "secret-none-hidden",
        visibility: "player_visible",
        publishStatus: "published",
        secretLevel: "none",
        revealState: "hidden",
      },
    ] as const;

    for (const page of pages) {
      await repo.createPage({
        worldId: world.id,
        title: page.slug,
        slug: page.slug,
        type: "note",
        visibility: page.visibility,
        publishStatus: page.publishStatus,
        secretLevel: "secretLevel" in page ? page.secretLevel : "none",
        revealState: "revealState" in page ? page.revealState : "hidden",
      });
    }

    // Aman is granted the specific-players page and has unlocked the unlock page.
    const specific = await db.page.findFirstOrThrow({
      where: { world: { slug: worldSlug }, slug: "specific-published" },
    });
    const unlock = await db.page.findFirstOrThrow({
      where: { world: { slug: worldSlug }, slug: "unlock-published" },
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
    // Staff must see the full world, including archived/private/draft/secret.
    assert.deepEqual(
      new Set(await narrowedSlugs(ctx)),
      new Set([
        "pub-published",
        "pv-published",
        "dmonly-published",
        "private-published",
        "archived-visibility",
        "pv-draft",
        "pv-internal",
        "pv-review",
        "pub-archived-status",
        "specific-published",
        "unlock-published",
        "secret-hidden",
        "secret-revealed",
        "spoiler-preview",
        "secret-none-hidden",
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
      new Set([
        "pub-published",
        "pv-published",
        "specific-published",
        "unlock-published",
        "secret-revealed",
        "secret-none-hidden",
      ]),
    );
  });

  it("ungranted player result equals the baseline (specific/unlock stay hidden)", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: lazulUserId });
    assert.ok(ctx);
    assert.equal(ctx.effectiveRole, "player");
    const narrowed = await narrowedSlugs(ctx);
    assert.deepEqual(narrowed, await baselineSlugs(ctx));
    assert.ok(!narrowed.includes("specific-published"));
    assert.ok(!narrowed.includes("unlock-published"));
    assert.ok(!narrowed.includes("dmonly-published"));
    assert.ok(!narrowed.includes("secret-hidden"));
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
