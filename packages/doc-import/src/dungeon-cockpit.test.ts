import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createTestDatabaseUrl } from "@uwe/database/test-helpers";
import {
  buildWorldWikiIndex,
  createDungeonCockpitService,
  createUweRepository,
} from "@uwe/database/server";

import { buildDocImportPlan } from "./plan";
import { writeDocImport } from "./writer";

/**
 * Der Ende-zu-Ende-Beleg für den Fehler, um den es hier ging.
 *
 * Ein Dungeonbuch wurde importiert, und das Dungeon-Cockpit zeigte **eine**
 * Ebene: „Teil D — Das Dach". Der Grund lag zwei Schichten auseinander — der
 * Import hängte die Ebenen unter die Gliederungsklammer „TEIL C", das Cockpit
 * liest aber nur direkte Kinder der Dungeon-Seite. Beide Seiten für sich waren
 * plausibel; erst zusammen ergaben sie ein leeres Cockpit.
 *
 * Deshalb prüft dieser Test nicht den Plan, sondern das, was am Spieltisch
 * ankommt: Was steht im Cockpit, nachdem der Import gelaufen ist.
 */

const BUCH = [
  "# DER MAGISTER-TURM VON VALIDORI",
  "### Ein Dungeon für Stufe 8",
  "# TEIL A — FÜR DIE SPIELLEITUNG",
  "Der Turm ist eine Pumpe. Das weiß niemand.",
  "# TEIL B — DIE WURZELPLATTFORM",
  "Von hier aus sieht man den Turm.",
  "# TEIL C — DER TURM",
  "## C.1 EBENE 1 — Der versiegelte Eingangsring",
  "Ein zeremonielles Foyer.",
  "### C.1.1 Die Räume",
  "- **Der Ring:** Das Foyer läuft als Kreisgang um den Hohlkern.",
  "- **Die Wachstube (Ost):** Waffenständer, ein kaltes Kohlebecken.",
  "### C.1.3 Die Bannläufer (Begegnung, vermeidbar)",
  "Drei Steinfiguren in Magistertracht.",
  "## C.2 EBENE 2 — Archiv und Sternkartensaal",
  "Der ganze Ring ist eine Bibliothek.",
  "# TEIL D — DAS DACH",
  "Nepurga wartet.",
  "# TEIL F — WERTEBLÖCKE",
  "**F.2 Bannläufer** — *Konstrukt*",
  "**RK** 17 · **TP** 68",
  "**F.10 Nepurga** — *Feenwesen*",
  "**RK** 17 · **TP** 240",
].join("\n\n");

describe("Dokument-Import → Dungeon-Cockpit", () => {
  let databaseUrl: string;

  before(async () => {
    databaseUrl = createTestDatabaseUrl();

    const repo = createUweRepository(databaseUrl);
    await repo.createWorld({ name: "Validori", slug: "validori-cockpit" });

    const plan = buildDocImportPlan([{ fileName: "turm.md", content: BUCH }], {
      mode: "document",
      profile: "dungeon",
    });

    const result = await writeDocImport(repo, plan.pages, plan.relations, {
      worldSlug: "validori-cockpit",
      confirmed: true,
    });
    assert.equal(result.failed, 0);
  });

  after(async () => {
    const { createPrismaClient } = await import("@uwe/database/client");
    await createPrismaClient(databaseUrl).$disconnect();
  });

  it("zeigt jede Ebene, nicht nur die eine ohne Gliederungsklammer", async () => {
    const repo = createUweRepository(databaseUrl);
    const wikiIndex = await buildWorldWikiIndex(repo, "validori-cockpit");
    const cockpit = createDungeonCockpitService(databaseUrl);

    const overview = await cockpit.getDungeonOverview(
      "validori-cockpit",
      "der-magister-turm-von-validori",
      wikiIndex,
    );

    assert.ok(overview);
    assert.deepEqual(
      overview.levels.map((level) => level.title),
      [
        "Die Wurzelplattform",
        "EBENE 1 — Der versiegelte Eingangsring",
        "EBENE 2 — Archiv und Sternkartensaal",
        "Das Dach",
      ],
    );
  });

  it("ordnet die Ebenen wie das Buch, nicht wie das Alphabet", async () => {
    const repo = createUweRepository(databaseUrl);
    const wikiIndex = await buildWorldWikiIndex(repo, "validori-cockpit");
    const cockpit = createDungeonCockpitService(databaseUrl);

    const overview = await cockpit.getDungeonOverview(
      "validori-cockpit",
      "der-magister-turm-von-validori",
      wikiIndex,
    );

    // Alphabetisch stünde „Das Dach" ganz vorn.
    assert.equal(overview?.levels.at(-1)?.title, "Das Dach");
  });

  it("zeigt die Werteblöcke als Anhang statt sie zu verstecken", async () => {
    const repo = createUweRepository(databaseUrl);
    const wikiIndex = await buildWorldWikiIndex(repo, "validori-cockpit");
    const cockpit = createDungeonCockpitService(databaseUrl);

    const overview = await cockpit.getDungeonOverview(
      "validori-cockpit",
      "der-magister-turm-von-validori",
      wikiIndex,
    );

    assert.ok(overview?.appendix.some((page) => page.title === "Werteblöcke"));
  });

  it("füllt die Ebene mit Räumen und zeigt die Begegnung daneben", async () => {
    const cockpit = createDungeonCockpitService(databaseUrl);

    const level = await cockpit.getLevelOverview(
      "validori-cockpit",
      "der-magister-turm-von-validori",
      "ebene-1-der-versiegelte-eingangsring",
    );

    assert.ok(level);
    assert.deepEqual(
      level.rooms.map((room) => room.title),
      ["Der Ring", "Die Wachstube (Ost)"],
    );
    assert.deepEqual(
      level.extras.map((page) => [page.title, page.type]),
      [["Die Bannläufer", "encounter"]],
    );
  });

  it("legt jeden Werteblock als eigene Seite an", async () => {
    const repo = createUweRepository(databaseUrl);
    const nepurga = await repo.getPageBySlug("validori-cockpit", "nepurga");

    assert.ok(nepurga);
    assert.equal(nepurga.type, "monster");
    assert.deepEqual(nepurga.aliases, ["F.10"]);
  });
});
