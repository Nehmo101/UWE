import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Der Bruch, wegen dem es diese Datei gibt.
 *
 * `listPagesWithBlocksForGraphUnfiltered` lud die Inhaltsblöcke als `include`.
 * Prisma setzt dafür ein `… WHERE page_id IN (?, ?, …)` mit einem Bind-Parameter
 * je Seite ab, und SQLite bricht oberhalb von rund tausend Parametern mit
 * `P2029` ab. Weil diese Abfrage unter jedem Seitenaufruf liegt, war damit nicht
 * eine Seite kaputt, sondern das ganze Studio — beobachtet, als die Welt `terra`
 * auf 1.511 Seiten wuchs.
 *
 * Der Test legt bewusst mehr Seiten an, als Parameter erlaubt sind. Er ist
 * langsamer als die übrigen und dafür der einzige, der diesen Fehler findet.
 */
describe("listPagesWithBlocksForGraphUnfiltered über dem SQLite-Parameterrahmen", () => {
  const SEITEN = 1_200;
  let repo: ReturnType<typeof createUweRepository>;
  let worldSlug: string;

  before(async () => {
    repo = createUweRepository(createTestDatabaseUrl());
    const world = await repo.createWorld({
      name: "Grosse Welt",
      slug: "grosse-welt",
      description: "Mehr Seiten als Bind-Parameter",
    });
    worldSlug = world.slug;

    for (let i = 0; i < SEITEN; i += 1) {
      const nummer = String(i).padStart(4, "0");
      await repo.createPage({
        worldId: world.id,
        title: `Seite ${nummer}`,
        slug: `seite-${nummer}`,
        type: "lore",
        contentBlocks: [
          { type: "rich_text", sortOrder: 0, content: `Erster Block von ${nummer}.` },
          { type: "rich_text", sortOrder: 1, content: `Zweiter Block von ${nummer}.` },
        ],
      });
    }
  });

  it("liefert alle Seiten, statt an P2029 zu scheitern", async () => {
    const pages = await repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {});
    assert.equal(pages.length, SEITEN);
  });

  it("hängt jeder Seite ihre eigenen Blöcke an, in Reihenfolge", async () => {
    const pages = await repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {});

    // Genau an einer Scheibengrenze und einmal weit dahinter nachsehen — ein
    // Zuordnungsfehler beim Zusammensetzen faellt sonst nicht auf.
    for (const index of [0, 499, 500, 501, 999, SEITEN - 1]) {
      const page = pages[index];
      const nummer = page.slug.replace("seite-", "");
      assert.equal(page.contentBlocks.length, 2, `${page.slug} hat nicht zwei Bloecke`);
      assert.deepEqual(
        page.contentBlocks.map((block) => block.content),
        [`Erster Block von ${nummer}.`, `Zweiter Block von ${nummer}.`],
        `${page.slug} hat fremde oder vertauschte Bloecke`,
      );
    }
  });

  it("bleibt nach Titel sortiert", async () => {
    const pages = await repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {});
    const titles = pages.map((page) => page.title);
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
  });

  it("achtet weiterhin auf den Typfilter", async () => {
    const pages = await repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, { types: ["npc"] });
    assert.equal(pages.length, 0);
  });
});
