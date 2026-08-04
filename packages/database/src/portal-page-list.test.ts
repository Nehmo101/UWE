import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AccessContext } from "@uwe/auth";
import { filterPagesForViewer } from "@uwe/auth";
import { createAuthService, type AuthService } from "./auth";
import { seedAuthUsers } from "./auth-seed";
import { createPrismaClient } from "./client";
import { listPagesForViewerPaged } from "./portal-page-list";
import { createTestDatabaseUrl } from "./test-helpers";
import { createUweRepository, type UweRepository } from "./repository";

/**
 * Sicherheits- und Äquivalenznetz für `listPagesForViewerPaged` — das
 * Gegenstück zu `list-pages-narrowing.test.ts` für die paginierte Liste:
 * Typ-/Text-Filter und Cursor in der DB-Query sind reine Performance, das Tor
 * bleibt `filterPagesForViewer`. Eine gesperrte Seite (portalReleased=false)
 * darf für Spieler NIE auftauchen — auch nicht über einen Query-Filter, der
 * gezielt ihren Titel oder ihre Kurzbeschreibung trifft.
 */
describe("listPagesForViewerPaged", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let auth: AuthService;
  let repo: UweRepository;
  let worldSlug: string;
  let dmUserId: string;
  let playerUserId: string;

  // Titel bewusst mit eindeutiger Sortierordnung, damit die Cursor-Ketten
  // deterministisch sind. „Über den Fluss" prüft die Umlaut-Suche.
  const releasedPages = [
    { slug: "alpha-quest", title: "Alpha Quest", type: "quest" },
    { slug: "beto-npc", title: "Beto der Händler", type: "npc" },
    { slug: "cirdan-npc", title: "Cirdan", type: "npc" },
    { slug: "delta-handout", title: "Delta Brief", type: "handout" },
    { slug: "ueber-den-fluss", title: "Über den Fluss", type: "lore" },
  ] as const;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    repo = createUweRepository(databaseUrl);
    auth = createAuthService(db);

    const world = await repo.createWorld({
      name: "Paged List World",
      slug: "paged-list-world",
      description: "listPagesForViewerPaged Sicherheit + Pagination",
    });
    worldSlug = world.slug;

    const users = await seedAuthUsers(auth, repo, world.id);
    dmUserId = users.dm.id;
    playerUserId = users.players[0]!.id;

    for (const page of releasedPages) {
      await repo.createPage({
        worldId: world.id,
        title: page.title,
        slug: page.slug,
        type: page.type,
        portalReleased: true,
      });
    }

    // Die gesperrte Seite: eindeutige Begriffe in Titel UND Kurzbeschreibung,
    // damit die Query-Filter-Tests gezielt auf sie zielen können.
    await repo.createPage({
      worldId: world.id,
      title: "Geheimplan der Verschwörer",
      slug: "geheimplan",
      type: "npc",
      summary: "Der Maulwurf heißt Zaltrix.",
      portalReleased: false,
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  async function playerCtx(): Promise<AccessContext> {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: playerUserId });
    assert.ok(ctx);
    return ctx;
  }

  async function dmCtx(): Promise<AccessContext> {
    const ctx = await auth.buildAccessContextForWorld(worldSlug, { userId: dmUserId });
    assert.ok(ctx);
    return ctx;
  }

  it("entspricht ohne Filter der findMany-plus-Filter-Baseline (Spieler)", async () => {
    const ctx = await playerCtx();
    const baseline = filterPagesForViewer(
      ctx,
      await db.page.findMany({
        where: { world: { slug: worldSlug } },
        orderBy: [{ title: "asc" }, { id: "asc" }],
      }),
    ).map((page) => page.slug);

    const { pages, nextCursor } = await listPagesForViewerPaged(db, worldSlug, ctx, {
      limit: 100,
    });
    assert.equal(nextCursor, null);
    assert.deepEqual(pages.map((page) => page.slug), baseline);
  });

  it("DM sieht auch die gesperrte Seite (Studio-Häkchen geht vor)", async () => {
    const ctx = await dmCtx();
    const { pages } = await listPagesForViewerPaged(db, worldSlug, ctx, { limit: 100 });
    assert.ok(pages.some((page) => page.slug === "geheimplan"));
  });

  it("Cursor-Kette liefert alle Seiten genau einmal, in Titelordnung", async () => {
    const ctx = await playerCtx();
    const collected: string[] = [];
    let cursor: string | undefined;

    for (let round = 0; round < 10; round += 1) {
      const { pages, nextCursor } = await listPagesForViewerPaged(db, worldSlug, ctx, {
        limit: 2,
        cursor,
      });
      collected.push(...pages.map((page) => page.slug));
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    assert.deepEqual(
      collected,
      ["alpha-quest", "beto-npc", "cirdan-npc", "delta-handout", "ueber-den-fluss"],
    );
  });

  it("Typ-Filter liefert nur freigegebene Seiten dieses Typs", async () => {
    const ctx = await playerCtx();
    const { pages } = await listPagesForViewerPaged(db, worldSlug, ctx, { type: "npc" });
    // Die gesperrte npc-Seite (geheimplan) fehlt, die freigegebenen sind da.
    assert.deepEqual(pages.map((page) => page.slug), ["beto-npc", "cirdan-npc"]);
  });

  it("Text-Filter findet Umlaut-Titel unabhängig von der Schreibung", async () => {
    const ctx = await playerCtx();
    for (const query of ["über", "Über", "ÜBER", "fluss"]) {
      const { pages } = await listPagesForViewerPaged(db, worldSlug, ctx, { query });
      assert.deepEqual(
        pages.map((page) => page.slug),
        ["ueber-den-fluss"],
        `query "${query}" muss die Umlaut-Seite finden`,
      );
    }
  });

  it("gesperrte Seite erscheint nie — auch nicht via Query- oder Typ-Filter", async () => {
    const ctx = await playerCtx();

    // Query auf den Titel der gesperrten Seite.
    const byTitle = await listPagesForViewerPaged(db, worldSlug, ctx, { query: "Geheimplan" });
    assert.deepEqual(byTitle.pages, []);

    // Query auf ein Wort, das nur in ihrer Kurzbeschreibung steht.
    const bySummary = await listPagesForViewerPaged(db, worldSlug, ctx, { query: "Zaltrix" });
    assert.deepEqual(bySummary.pages, []);

    // Kombination aus Typ- und Query-Filter.
    const byBoth = await listPagesForViewerPaged(db, worldSlug, ctx, {
      type: "npc",
      query: "Verschwörer",
    });
    assert.deepEqual(byBoth.pages, []);
  });

  it("anonymer Besucher bekommt nichts — fail-closed wie die Vollliste", async () => {
    const ctx = await auth.buildAccessContextForWorld(worldSlug);
    assert.ok(ctx);
    assert.equal(ctx.user, null);
    const { pages } = await listPagesForViewerPaged(db, worldSlug, ctx);
    assert.deepEqual(pages, []);
  });

  it("unbekannte Welt liefert leer statt zu werfen", async () => {
    const ctx = await playerCtx();
    const result = await listPagesForViewerPaged(db, "gibt-es-nicht", ctx);
    assert.deepEqual(result, { pages: [], nextCursor: null });
  });
});
