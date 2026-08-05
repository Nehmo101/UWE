import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient } from "@uwe/database/client";
import { createUweRepository } from "@uwe/database/server";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  buildChapterPrintHtml,
  buildChapterPrintMarkdown,
  getChapterPrintData,
} from "./chapter-print";
import { createCampaignCockpitService } from "./cockpit-service";

const SECRET = "Der wahre Verräter ist der Bürgermeister";
const PUBLIC_LINE = "Die Karawane erreicht den Pass";

describe("chapter print (integration)", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let worldId: string;
  let chapterId: string;
  const worldSlug = "druck-test";

  before(async () => {
    const url = createTestDatabaseUrl();
    db = createPrismaClient(url);
    const world = await createUweRepository(url).createWorld({
      name: "Druck",
      slug: worldSlug,
    });
    worldId = world.id;
    const campaign = await db.campaign.create({
      data: { worldId, name: "Passreise", slug: "passreise" },
    });
    const chapter = await createCampaignCockpitService(db).createChapter({
      worldId,
      campaignId: campaign.id,
      title: "Akt I",
      content: `${PUBLIC_LINE}\n\n:::dm\n${SECRET}\n:::`,
    });
    chapterId = chapter.id;
    await db.page.create({
      data: {
        worldId,
        campaignId: campaign.id,
        parentPageId: chapter.id,
        title: "Die Eskorte",
        slug: "die-eskorte",
        type: "quest",
        questStatus: "open",
        contentBlocks: {
          create: [
            {
              type: "rich_text",
              sortOrder: 0,
              content: `Öffentlicher Questtext.\n:::dm\n${SECRET}\n:::`,
            },
          ],
        },
      },
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("DM variant keeps :::dm content, marked as DM box", async () => {
    const data = await getChapterPrintData(db, worldSlug, chapterId, {
      variant: "dm",
      wikiIndex: [],
      graph: null,
    });
    assert.ok(data);
    const html = buildChapterPrintHtml(data);
    assert.ok(html.includes(SECRET));
    assert.ok(html.includes('class="wiki-dm-section"'));
    assert.ok(html.includes(PUBLIC_LINE));
    assert.ok(buildChapterPrintMarkdown(data).includes(SECRET));
  });

  it("player variant NEVER contains DM sections (privacy invariant)", async () => {
    const data = await getChapterPrintData(db, worldSlug, chapterId, {
      variant: "spieler",
      wikiIndex: [],
      graph: null,
    });
    assert.ok(data);
    const html = buildChapterPrintHtml(data);
    assert.equal(html.includes(SECRET), false);
    // Nicht auf den bloßen String prüfen — die Druck-CSS enthält den Selektor.
    assert.equal(html.includes('class="wiki-dm-section"'), false);
    assert.ok(html.includes(PUBLIC_LINE));
    assert.ok(html.includes("Die Eskorte"));

    const markdown = buildChapterPrintMarkdown(data);
    assert.equal(markdown.includes(SECRET), false);
    assert.equal(markdown.includes(":::dm"), false);
  });

  it("returns null for a non-chapter id", async () => {
    const quest = await db.page.findFirst({ where: { worldId, type: "quest" } });
    assert.ok(quest);
    const data = await getChapterPrintData(db, worldSlug, quest.id, {
      variant: "dm",
      wikiIndex: [],
      graph: null,
    });
    assert.equal(data, null);
  });
});
