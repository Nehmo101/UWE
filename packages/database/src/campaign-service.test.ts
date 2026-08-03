import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { CampaignServiceError, createCampaignService } from "./campaign-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

describe("campaign service", () => {
  let db: ReturnType<typeof createPrismaClient>;
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
    await createUweRepository(databaseUrl).createWorld({
      name: "Kampagnenwelt",
      slug: "kampagnenwelt",
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("returns an empty list for an unknown world", async () => {
    assert.deepEqual(await createCampaignService(db).listOverview("gibt-es-nicht"), []);
  });

  it("creates a campaign with a German slug", async () => {
    const created = await createCampaignService(db).create({
      worldSlug: "kampagnenwelt",
      name: "Schatten über Validori",
    });
    assert.equal(created.slug, "schatten-ueber-validori");
  });

  it("rejects a duplicate name in the same world", async () => {
    await assert.rejects(
      () =>
        createCampaignService(db).create({
          worldSlug: "kampagnenwelt",
          name: "Schatten über Validori",
        }),
      CampaignServiceError,
    );
  });

  it("rejects an empty name", async () => {
    await assert.rejects(
      () => createCampaignService(db).create({ worldSlug: "kampagnenwelt", name: "   " }),
      CampaignServiceError,
    );
  });

  it("rejects an unknown world", async () => {
    await assert.rejects(
      () => createCampaignService(db).create({ worldSlug: "gibt-es-nicht", name: "Egal" }),
      CampaignServiceError,
    );
  });

  it("lists campaigns with content counts", async () => {
    const campaigns = await createCampaignService(db).listOverview("kampagnenwelt");
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0]?.counts.pages, 0);
    assert.equal(campaigns[0]?.counts.playerNotes, 0);
  });

  it("moves the slug along when it was still the auto-generated one", async () => {
    const service = createCampaignService(db);
    const [campaign] = await service.listOverview("kampagnenwelt");
    const renamed = await service.rename({
      worldSlug: "kampagnenwelt",
      campaignId: campaign!.id,
      name: "Asche über Validori",
    });
    assert.equal(renamed.slug, "asche-ueber-validori");
  });

  it("keeps a hand-picked slug across a rename", async () => {
    const service = createCampaignService(db);
    const created = await service.create({ worldSlug: "kampagnenwelt", name: "Zweite Kampagne" });
    await db.campaign.update({ where: { id: created.id }, data: { slug: "import-2024" } });

    const renamed = await service.rename({
      worldSlug: "kampagnenwelt",
      campaignId: created.id,
      name: "Dritte Kampagne",
    });
    assert.equal(renamed.slug, "import-2024");
  });

  it("refuses to delete without the exact name", async () => {
    const service = createCampaignService(db);
    const campaign = (await service.listOverview("kampagnenwelt"))[0];
    await assert.rejects(
      () =>
        service.remove({
          worldSlug: "kampagnenwelt",
          campaignId: campaign!.id,
          expectedName: "falsch",
        }),
      CampaignServiceError,
    );
  });

  it("deletes a campaign but keeps its pages in the world", async () => {
    const service = createCampaignService(db);
    const world = await db.world.findUniqueOrThrow({ where: { slug: "kampagnenwelt" } });
    const created = await service.create({ worldSlug: "kampagnenwelt", name: "Wegwerfkampagne" });

    const page = await db.page.create({
      data: {
        worldId: world.id,
        campaignId: created.id,
        title: "Bleibt bestehen",
        slug: "bleibt-bestehen",
        type: "lore",
      },
    });

    await service.remove({
      worldSlug: "kampagnenwelt",
      campaignId: created.id,
      expectedName: "Wegwerfkampagne",
    });

    const survivor = await db.page.findUnique({ where: { id: page.id } });
    assert.ok(survivor, "Seite darf die Kampagne überleben");
    assert.equal(survivor?.campaignId, null, "und gehört danach direkt zur Welt");
  });

  it("refuses to touch a campaign from another world", async () => {
    const service = createCampaignService(db);
    await createUweRepository(databaseUrl).createWorld({ name: "Fremdwelt", slug: "fremdwelt" });
    const created = await service.create({ worldSlug: "fremdwelt", name: "Fremde Kampagne" });

    await assert.rejects(
      () =>
        service.rename({
          worldSlug: "kampagnenwelt",
          campaignId: created.id,
          name: "Übernahme",
        }),
      CampaignServiceError,
    );
  });
});
