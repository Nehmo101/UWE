import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  AuthorizationError,
  assertCanReadContent,
  canReadContent,
  canReadWorld,
} from "@uwe/auth";
import { createAuthService } from "./auth";
import { createPrismaClient, type PrismaClient } from "./client";
import { createUweRepository, type UweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Integration tests for central authz — IDOR/BOLA prevention with real DB.
 */
describe("authz integration — IDOR/BOLA", () => {
  let db: PrismaClient;
  let repo: UweRepository;
  let auth: ReturnType<typeof createAuthService>;
  let worldAId: string;
  let worldBId: string;
  let privatePageBId: string;

  const worldASlug = "authz-world-a";
  const worldBSlug = "authz-world-b";

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    auth = createAuthService(db);

    const worldA = await repo.createWorld({ name: "World A", slug: worldASlug });
    worldAId = worldA.id;

    const worldB = await repo.createWorld({ name: "World B", slug: worldBSlug });
    worldBId = worldB.id;

    const userA = await auth.createUser({
      displayName: "Player A",
      email: "player-a@authz.test",
      password: "secret",
      role: "player",
    });

    await auth.createWorldMembership({
      userId: userA.id,
      worldId: worldAId,
      role: "player",
    });

    await repo.createPage({
      worldId: worldAId,
      title: "Public A",
      slug: "public-a",
      type: "lore",
    });

    const privatePageB = await repo.createPage({
      worldId: worldBId,
      title: "Secret B",
      slug: "secret-b",
      type: "secret",
    });
    privatePageBId = privatePageB.id;

    // A player-visible page in the foreign, members-only world B. A non-member
    // must NOT receive it through the viewer list services.
    await repo.createPage({
      worldId: worldBId,
      title: "Public B",
      slug: "public-b",
      type: "lore",
    });
  });

  it("blocks a non-member from listing a foreign world's player-visible pages", async () => {
    const userA = await auth.findUserByEmail("player-a@authz.test");
    assert.ok(userA);

    // World B is members-only (guestModeEnabled defaults to false) and User A
    // is not a member. Before the world-membership guard, listPagesForViewer
    // returned World B's player-visible pages to any logged-in player.
    const ctxB = await auth.buildAccessContextForWorld(worldBSlug, { userId: userA.id });
    assert.ok(ctxB);

    const pages = await auth.listPagesForViewer(worldBSlug, ctxB);
    assert.deepEqual(pages, []);
  });

  it("blocks User A from reading World B via authz", async () => {
    const userA = await auth.findUserByEmail("player-a@authz.test");
    assert.ok(userA);

    const ctxB = await auth.buildAccessContextForWorld(worldBSlug, { userId: userA.id });
    assert.ok(ctxB);

    assert.equal(
      canReadWorld(auth.toAuthUser(userA), {
        id: worldBId,
        guestModeEnabled: false,
        membership: ctxB.worldMembership,
      }),
      false,
    );
  });

  it("blocks direct ID lookup on private resource in foreign world", async () => {
    const userA = await auth.findUserByEmail("player-a@authz.test");
    assert.ok(userA);

    const ctxA = await auth.buildAccessContextForWorld(worldASlug, { userId: userA.id });
    assert.ok(ctxA);

    const foreignPage = await db.page.findUnique({ where: { id: privatePageBId } });
    assert.ok(foreignPage);

    const scope = {
      world: {
        id: worldBId,
        guestModeEnabled: false,
        membership: null,
      },
    };

    assert.throws(
      () =>
        assertCanReadContent(
          auth.toAuthUser(userA),
          foreignPage,
          scope.world,
        ),
      (error: unknown) => error instanceof AuthorizationError,
    );

    const leakedViaViewer = await auth.getPageForViewer(worldBSlug, "secret-b", ctxA);
    assert.equal(leakedViaViewer, null);
  });

  it("lets a world member read every page of their own world", async () => {
    await repo.createPage({
      worldId: worldAId,
      title: "DM Plan",
      slug: "dm-plan",
      type: "lore",
    });

    const userA = await auth.findUserByEmail("player-a@authz.test");
    assert.ok(userA);

    const ctxA = await auth.buildAccessContextForWorld(worldASlug, { userId: userA.id });
    assert.ok(ctxA);

    const page = await auth.getPageForViewer(worldASlug, "dm-plan", ctxA);
    assert.ok(page);

    const dmPage = await db.page.findFirst({
      where: { slug: "dm-plan", worldId: worldAId },
    });
    assert.ok(dmPage);

    assert.equal(
      canReadContent(
        auth.toAuthUser(userA),
        dmPage,
        { id: worldAId, guestModeEnabled: false, membership: ctxA.worldMembership },
        { previewAsUserId: ctxA.previewAsUserId },
      ),
      true,
    );
  });

  it("allows OWNER to read everything", async () => {
    const owner = await auth.createUser({
      displayName: "Owner",
      email: "owner@authz.test",
      password: "secret",
      role: "owner",
    });

    const ctx = await auth.buildAccessContextForWorld(worldBSlug, { userId: owner.id });
    assert.ok(ctx);

    const page = await auth.getPageForViewer(worldBSlug, "secret-b", ctx);
    assert.ok(page);
    assert.equal(page.title, "Secret B");
  });
});
