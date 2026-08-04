import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAuthService } from "./auth";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Der DM-Bereich (`:::dm … :::`) auf den echten Lesepfaden.
 *
 * Die Textmarke selbst ist in `@uwe/auth` getestet. Hier steht die Frage
 * dahinter: Kommt das Geheimnis wirklich bei niemandem an, der es nicht lesen
 * darf — über die Seite, über das gerenderte HTML, über die Suche, und
 * überlebt es die Bearbeitung durch genau die Person, die es nie gesehen hat?
 *
 * `SECRET` ist absichtlich ein Wort, das sonst nirgends vorkommt: jeder Treffer
 * darauf ist ein Leck.
 */
const SECRET = "Roderickverrat";
const PUBLIC_LINE = "Der Hauptmann empfängt euch freundlich.";

describe("DM-Bereich im Wikitext — Lesepfade", () => {
  let databaseUrl: string;
  let worldSlug: string;
  let dmUserId: string;
  let playerUserId: string;
  let characterBlockId: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    const db = createPrismaClient(databaseUrl);
    const repo = createUweRepository(databaseUrl);
    const auth = createAuthService(db);

    const world = await repo.createWorld({ name: "DM Bereich", slug: "dm-bereich" });
    worldSlug = world.slug;

    const dm = await auth.createUser({
      displayName: "DM",
      email: "dm-dmsection@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: true,
    });
    dmUserId = dm.id;

    const player = await auth.createUser({
      displayName: "Spielerin",
      email: "player-dmsection@test.local",
      password: "test",
      portalAccess: true,
      studioAccess: false,
    });
    playerUserId = player.id;

    await auth.createWorldMembership({ userId: dm.id, worldId: world.id });
    await auth.createWorldMembership({ userId: player.id, worldId: world.id });

    await repo.createPage({
      worldId: world.id,
      title: "Hauptmann Roderick",
      slug: "hauptmann-roderick",
      type: "npc",
      portalReleased: true,
      summary: `Ein Offizier der Wache.\n:::dm\n${SECRET} ist geplant.\n:::`,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: `${PUBLIC_LINE}\n:::dm Der wahre Verräter\n${SECRET}: Er arbeitet für die Gegenseite.\n:::\nDanach geht ihr weiter.`,
        },
      ],
    });

    const character = await repo.createPage({
      worldId: world.id,
      title: "Aman",
      slug: "aman",
      type: "player_character",
      portalReleased: true,
      contentBlocks: [
        {
          type: "rich_text",
          sortOrder: 0,
          content: `Aman, Waldläuferin.\n:::dm\n${SECRET} betrifft auch sie.\n:::`,
        },
      ],
    });
    characterBlockId = character.contentBlocks[0].id;

    await db.$disconnect();
  });

  after(async () => {
    await createPrismaClient(databaseUrl).$disconnect();
  });

  async function withAuth<T>(
    userId: string,
    run: (deps: {
      auth: ReturnType<typeof createAuthService>;
      ctx: NonNullable<Awaited<ReturnType<ReturnType<typeof createAuthService>["buildAccessContextForWorld"]>>>;
    }) => Promise<T>,
    preview?: { previewAsUserId: string },
  ): Promise<T> {
    const db = createPrismaClient(databaseUrl);
    try {
      const auth = createAuthService(db);
      const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId, preview });
      assert.ok(ctx);
      return await run({ auth, ctx: ctx! });
    } finally {
      await db.$disconnect();
    }
  }

  it("gibt dem DM den Block mitsamt Marke", async () => {
    const content = await withAuth(dmUserId, async ({ auth, ctx }) => {
      const page = await auth.getPageForViewer(worldSlug, "hauptmann-roderick", ctx);
      return page!.contentBlocks[0].content;
    });

    assert.ok(content.includes(SECRET));
    assert.ok(content.includes(":::dm"));
  });

  it("schneidet den Bereich für die Spielerin aus Block und Kurzbeschreibung", async () => {
    const page = await withAuth(playerUserId, async ({ auth, ctx }) =>
      auth.getPageForViewer(worldSlug, "hauptmann-roderick", ctx),
    );

    assert.ok(page);
    assert.equal(page!.contentBlocks[0].content.includes(SECRET), false);
    assert.equal(page!.contentBlocks[0].content.includes(":::"), false);
    assert.ok(page!.contentBlocks[0].content.includes(PUBLIC_LINE));
    assert.equal(page!.summary?.includes(SECRET), false);
  });

  it("hält den Bereich aus dem gerenderten HTML der Spielerin heraus", async () => {
    const rendered = await withAuth(playerUserId, async ({ auth, ctx }) => {
      const page = await auth.getPageForViewer(worldSlug, "hauptmann-roderick", ctx);
      return auth.renderBlockContentForViewer(worldSlug, page!.contentBlocks[0].content, ctx);
    });

    assert.equal(rendered.includes(SECRET), false);
    assert.equal(rendered.includes("wiki-dm-section"), false);
    assert.ok(rendered.includes(PUBLIC_LINE));
  });

  it("schneidet auch dann, wenn der rohe Inhalt am Blockfilter vorbei zum Renderer kommt", async () => {
    const raw = `${PUBLIC_LINE}\n:::dm\n${SECRET}\n:::`;
    const rendered = await withAuth(playerUserId, ({ auth, ctx }) =>
      auth.renderBlockContentForViewer(worldSlug, raw, ctx),
    );

    assert.equal(rendered.includes(SECRET), false);
  });

  it("rendert dem DM den sichtbaren Kasten", async () => {
    const rendered = await withAuth(dmUserId, async ({ auth, ctx }) => {
      const page = await auth.getPageForViewer(worldSlug, "hauptmann-roderick", ctx);
      return auth.renderBlockContentForViewer(worldSlug, page!.contentBlocks[0].content, ctx);
    });

    assert.ok(rendered.includes('class="wiki-dm-section"'));
    assert.ok(rendered.includes("Nur für den DM — Der wahre Verräter"));
    assert.ok(rendered.includes(SECRET));
  });

  it("nimmt dem DM den Bereich in der Vorschau als Spielerin weg", async () => {
    const content = await withAuth(
      dmUserId,
      async ({ auth, ctx }) => {
        const page = await auth.getPageForViewer(worldSlug, "hauptmann-roderick", ctx);
        return page!.contentBlocks[0].content;
      },
      { previewAsUserId: playerUserId },
    );

    assert.equal(content.includes(SECRET), false);
  });

  it("findet das Geheimnis in der Suche nur für den DM", async () => {
    const dmHits = await withAuth(dmUserId, ({ auth, ctx }) =>
      auth.searchForViewer(worldSlug, ctx, { query: SECRET }),
    );
    assert.ok(dmHits.length > 0);

    const playerHits = await withAuth(playerUserId, ({ auth, ctx }) =>
      auth.searchForViewer(worldSlug, ctx, { query: SECRET }),
    );
    assert.deepEqual(playerHits, []);
  });

  it("liefert der Spielerin weiterhin Treffer im offenen Text — und keinen Ausschnitt mit Geheimnis", async () => {
    const hits = await withAuth(playerUserId, ({ auth, ctx }) =>
      auth.searchForViewer(worldSlug, ctx, { query: "Hauptmann" }),
    );

    assert.ok(hits.length > 0);
    for (const hit of hits) {
      assert.equal(hit.snippet?.includes(SECRET) ?? false, false);
    }
  });

  it("rettet den DM-Bereich, wenn die Spielerin ihren eigenen Charakterblock speichert", async () => {
    const updated = await withAuth(playerUserId, ({ auth, ctx }) =>
      auth.updatePlayerCharacterBlockForViewer(
        worldSlug,
        "aman",
        characterBlockId,
        "Aman, Waldläuferin und neuerdings Bogenschützin.",
        ctx,
      ),
    );

    // Was die Spielerin zurückbekommt, ist weiterhin geschnitten …
    assert.ok(updated);
    assert.equal(updated!.contentBlocks[0].content.includes(SECRET), false);
    assert.ok(updated!.contentBlocks[0].content.includes("Bogenschützin"));

    // … der DM findet seine Notiz aber unverändert vor.
    const dmContent = await withAuth(dmUserId, async ({ auth, ctx }) => {
      const page = await auth.getPageForViewer(worldSlug, "aman", ctx);
      return page!.contentBlocks[0].content;
    });
    assert.ok(dmContent.includes(SECRET));
    assert.ok(dmContent.includes("Bogenschützin"));
  });
});
