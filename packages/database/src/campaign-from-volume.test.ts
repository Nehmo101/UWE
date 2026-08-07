import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createCampaignService, CampaignServiceError } from "./campaign-service";
import { createPrismaClient } from "./client";
import { createUweRepository } from "./repository";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Aus einem Band eine Kampagne machen.
 *
 * Nach einem Dokument-Import liegt ein Kampagnenbuch als Seitenbaum in der Welt,
 * gehört aber zu keiner Kampagne — oder zu einer Sammelkampagne, in der schon
 * alles andere liegt. Diese Funktion macht aus dem Band das, was er ist, und
 * zieht die Dungeon-Bände mit hinein, die dazugehören.
 */
describe("Kampagne aus einem Band", () => {
  let url: string;
  let service: ReturnType<typeof createCampaignService>;
  let repo: ReturnType<typeof createUweRepository>;
  let bandId: string;
  let dungeonId: string;
  let fremdId: string;

  before(async () => {
    url = createTestDatabaseUrl();
    service = createCampaignService(createPrismaClient(url));
    repo = createUweRepository(url);

    const world = await repo.createWorld({ name: "Terra", slug: "terra" });

    const band = await repo.createPage({
      worldId: world.id,
      title: "Dunkelsonne",
      slug: "dunkelsonne",
      type: "lore",
    });
    bandId = band.id;
    const teil = await repo.createPage({
      worldId: world.id,
      parentPageId: band.id,
      title: "Teil 1",
      slug: "teil-1",
      type: "lore",
    });
    await repo.createPage({
      worldId: world.id,
      parentPageId: teil.id,
      title: "Ein Kapitel",
      slug: "ein-kapitel",
      type: "lore",
    });

    const dungeon = await repo.createPage({
      worldId: world.id,
      title: "Steinhaus",
      slug: "steinhaus",
      type: "dungeon",
    });
    dungeonId = dungeon.id;
    await repo.createPage({
      worldId: world.id,
      parentPageId: dungeon.id,
      title: "Ebene 1",
      slug: "ebene-1",
      type: "dungeon_level",
    });

    // Ein Band, der nicht mitwandern darf.
    const fremd = await repo.createPage({
      worldId: world.id,
      title: "Himmelsrouten",
      slug: "himmelsrouten",
      type: "lore",
    });
    fremdId = fremd.id;
    await repo.createPage({
      worldId: world.id,
      parentPageId: fremd.id,
      title: "Kapitel A",
      slug: "kapitel-a",
      type: "lore",
    });
  });

  it("findet die Bände einer Welt und zählt ihre Seiten", async () => {
    const bände = await service.listVolumeCandidates("terra");
    const namen = bände.map((b) => `${b.slug}:${b.pageCount}${b.isDungeon ? ":dungeon" : ""}`);
    assert.deepEqual(namen.sort(), ["dunkelsonne:3", "himmelsrouten:2", "steinhaus:2:dungeon"]);
  });

  it("legt die Kampagne an und ordnet Band und Dungeon zu", async () => {
    const result = await service.createFromVolume({
      worldSlug: "terra",
      volumePageId: bandId,
      dungeonPageIds: [dungeonId],
    });

    assert.equal(result.name, "Dunkelsonne", "ohne Namen gewinnt der Titel des Bandes");
    assert.equal(result.slug, "dunkelsonne");
    assert.equal(result.assigned, 5, "drei Seiten Band plus zwei Seiten Dungeon");
    assert.equal(result.dungeonsAttached, 1);

    const seiten = await repo.listPagesByWorld("terra");
    const inKampagne = seiten.filter((p) => p.campaign?.slug === "dunkelsonne").map((p) => p.slug);
    assert.deepEqual(inKampagne.sort(), ["dunkelsonne", "ebene-1", "ein-kapitel", "steinhaus", "teil-1"]);
  });

  it("lässt fremde Bände in Ruhe", async () => {
    const seiten = await repo.listPagesByWorld("terra");
    for (const slug of ["himmelsrouten", "kapitel-a"]) {
      const page = seiten.find((p) => p.slug === slug);
      assert.equal(page?.campaignId, null, `${slug} darf nicht mitgewandert sein`);
    }
  });

  it("hängt einen Band nachträglich an eine bestehende Kampagne", async () => {
    const kampagnen = await service.listOverview("terra");
    const dunkelsonne = kampagnen.find((k) => k.slug === "dunkelsonne");
    assert.ok(dunkelsonne);

    const result = await service.attachVolume({
      worldSlug: "terra",
      campaignId: dunkelsonne.id,
      volumePageId: fremdId,
    });
    assert.equal(result.assigned, 2);

    // …und wieder zurück, damit die übrigen Fälle unberührt bleiben.
    const seiten = await repo.listPagesByWorld("terra");
    for (const slug of ["himmelsrouten", "kapitel-a"]) {
      const page = seiten.find((p) => p.slug === slug);
      await repo.updatePage(page!.id, {});
    }
  });

  it("weigert sich bei einer Unterseite statt eines Bandes", async () => {
    const seiten = await repo.listPagesByWorld("terra");
    const unterseite = seiten.find((p) => p.slug === "teil-1")!;

    await assert.rejects(
      () => service.createFromVolume({ worldSlug: "terra", volumePageId: unterseite.id, name: "Falsch" }),
      (error: unknown) =>
        error instanceof CampaignServiceError && /kein Band/.test(error.message),
    );
  });

  it("weigert sich bei einem Namen, den es schon gibt", async () => {
    await assert.rejects(
      () =>
        service.createFromVolume({
          worldSlug: "terra",
          volumePageId: fremdId,
          name: "Dunkelsonne",
        }),
      (error: unknown) => error instanceof CampaignServiceError && /bereits/.test(error.message),
    );
  });

  it("überlebt einen Zyklus im Seitenbaum, statt sich aufzuhängen", async () => {
    // Ein Zyklus entsteht durch einen misslungenen Umzug: A trägt B, B trägt A.
    // Ohne Besuchsliste in `nachkommen` käme keiner der Aufrufe unten je zurück.
    const zyklusUrl = createTestDatabaseUrl();
    const zRepo = createUweRepository(zyklusUrl);
    const zService = createCampaignService(createPrismaClient(zyklusUrl));

    const world = await zRepo.createWorld({ name: "Zyklus", slug: "zyklus" });
    const wurzel = await zRepo.createPage({
      worldId: world.id,
      title: "Wurzel",
      slug: "wurzel",
      type: "lore",
    });
    // Ein Kind, das der Wurzel bleibt — sonst wäre sie nach dem Umzug kein Band mehr.
    await zRepo.createPage({
      worldId: world.id,
      parentPageId: wurzel.id,
      title: "Kapitel",
      slug: "kapitel",
      type: "lore",
    });
    const a = await zRepo.createPage({
      worldId: world.id,
      parentPageId: wurzel.id,
      title: "A",
      slug: "a",
      type: "lore",
    });
    const b = await zRepo.createPage({
      worldId: world.id,
      parentPageId: a.id,
      title: "B",
      slug: "b",
      type: "lore",
    });
    await zRepo.updatePage(a.id, { parentPageId: b.id });

    const bände = await zService.listVolumeCandidates("zyklus");
    const gefunden = bände.find((band) => band.slug === "wurzel");
    assert.ok(gefunden, "die Wurzel bleibt ein Band");

    const result = await zService.createFromVolume({
      worldSlug: "zyklus",
      volumePageId: wurzel.id,
      name: "Zyklische Kampagne",
    });
    assert.ok(result.assigned >= 1, "und der Lauf kommt zurück, statt zu kreisen");
  });
});
