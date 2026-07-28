import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import { createTerraService, type TerraService } from "./terra-service";
import { createTestDatabaseUrl } from "./test-helpers";

/**
 * Terra-Ablage (J1). Zwei Dinge stehen hier im Mittelpunkt, weil an ihnen
 * Daten hängen:
 *
 *  - die MANDANTENGRENZE: keine Methode darf eine Karte anfassen, die zu
 *    einer anderen Welt gehört — auch nicht, wenn die Id stimmt. Das ist der
 *    dritte Guard des Trios (nach CSRF/Origin und Rolle), und der einzige,
 *    der sich hier prüfen lässt.
 *  - die KONFLIKTERKENNUNG: zwei offene Reiter dürfen sich nicht gegenseitig
 *    überschreiben. Der Vergleich läuft im `where` des Schreibvorgangs, ist
 *    also atomar — ein Test mit zwei nacheinander abgeschickten Ständen auf
 *    derselben Ausgangsversion deckt genau das ab.
 */

let db: PrismaClient;
let terra: TerraService;

const BAUM_A = { format: "terra", version: 5, wurzel: "k0", karten: [{ id: "k0", elternId: null }] };
const BAUM_B = { format: "terra", version: 5, wurzel: "k0", karten: [{ id: "k0", elternId: null, titel: "B" }] };

before(async () => {
  db = createPrismaClient(createTestDatabaseUrl());
  terra = createTerraService(db);
  await db.world.create({ data: { name: "Terra Test World", slug: "terra-test" } });
  await db.world.create({ data: { name: "Terra Fremde Welt", slug: "terra-fremd" } });
});

describe("createTerraService — Ablage", () => {
  it("legt eine Karte an und findet sie über die Welt wieder", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Nordmark", daten: BAUM_A });
    assert.equal(karte.titel, "Nordmark");
    assert.equal(karte.version, 1, "eine frische Karte startet bei Fassung 1");

    const liste = await terra.listeFuerWelt("terra-test");
    assert.ok(liste.some((eintrag) => eintrag.id === karte.id));
    // Die Liste trägt bewusst kein `daten` — sie ist für Übersichten da.
    assert.equal("daten" in liste[0], false);
  });

  it("kappt überlange Titel und fällt auf eine Vorgabe zurück", async () => {
    const leer = await terra.erstelle("terra-test", { titel: "   " });
    assert.equal(leer.titel, "Karte");
    const lang = await terra.erstelle("terra-test", { titel: "x".repeat(500) });
    assert.equal(lang.titel.length, 120);
  });

  it("eine leere Karte darf ohne Baum entstehen", async () => {
    // Der Editor startet mit seiner eigenen Vorgabe und meldet den ersten
    // Stand selbst heraus — die Zeile muss dafür schon existieren.
    const karte = await terra.erstelle("terra-test", {});
    const gelesen = await terra.holeInWelt("terra-test", karte.id);
    assert.ok(gelesen);
    assert.equal(gelesen.daten, null);
  });
});

describe("createTerraService — Mandantengrenze", () => {
  it("holeInWelt liefert null für eine Karte aus einer fremden Welt", async () => {
    const fremd = await terra.erstelle("terra-fremd", { titel: "Fremdland", daten: BAUM_A });
    // Die Karte existiert — aber nicht in dieser Welt.
    assert.ok(await terra.holeInWelt("terra-fremd", fremd.id));
    assert.equal(await terra.holeInWelt("terra-test", fremd.id), null);
  });

  it("listeFuerWelt zeigt keine Karten fremder Welten", async () => {
    const fremd = await terra.erstelle("terra-fremd", { titel: "Nur drüben", daten: BAUM_A });
    const liste = await terra.listeFuerWelt("terra-test");
    assert.equal(liste.some((eintrag) => eintrag.id === fremd.id), false);
  });

  it("speichere schreibt nicht in eine Karte einer fremden Welt", async () => {
    const fremd = await terra.erstelle("terra-fremd", { titel: "Unantastbar", daten: BAUM_A });
    const ergebnis = await terra.speichere("terra-test", fremd.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
    });
    assert.deepEqual(ergebnis, { ok: false, grund: "unbekannt" });

    const unveraendert = await terra.holeInWelt("terra-fremd", fremd.id);
    assert.deepEqual(unveraendert?.daten, BAUM_A, "der Baum ist unberührt");
    assert.equal(unveraendert?.version, 1, "die Fassung ist unberührt");
  });

  it("loesche und benenne greifen nicht über die Weltgrenze", async () => {
    const fremd = await terra.erstelle("terra-fremd", { titel: "Bleibt", daten: BAUM_A });
    assert.equal(await terra.loesche("terra-test", fremd.id), false);
    assert.equal(await terra.benenne("terra-test", fremd.id, "Gekapert"), false);

    const unveraendert = await terra.holeInWelt("terra-fremd", fremd.id);
    assert.equal(unveraendert?.titel, "Bleibt");
  });

  it("eine unbekannte Welt scheitert, statt still nichts zu tun", async () => {
    await assert.rejects(() => terra.listeFuerWelt("gibt-es-nicht"));
    await assert.rejects(() => terra.erstelle("gibt-es-nicht", { titel: "X" }));
  });
});

describe("createTerraService — Konflikterkennung", () => {
  it("speichert auf der erwarteten Fassung und zählt sie hoch", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Zählwerk", daten: BAUM_A });
    const erste = await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 1 });
    assert.deepEqual(erste, { ok: true, version: 2 });

    const gelesen = await terra.holeInWelt("terra-test", karte.id);
    assert.deepEqual(gelesen?.daten, BAUM_B);
    assert.equal(gelesen?.version, 2);
  });

  it("lehnt ein Schreiben auf einer veralteten Fassung ab und überschreibt nicht", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Zwei Reiter", daten: BAUM_A });

    // Reiter 1 speichert.
    const reiterEins = await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 1 });
    assert.equal(reiterEins.ok, true);

    // Reiter 2 hat dieselbe Ausgangsfassung geladen und schickt jetzt los.
    const reiterZwei = await terra.speichere("terra-test", karte.id, {
      daten: { format: "terra", version: 5, wurzel: "k0", karten: [{ id: "k0", elternId: null, titel: "C" }] },
      erwarteteVersion: 1,
    });
    assert.deepEqual(reiterZwei, { ok: false, grund: "konflikt", version: 2 },
      "der zweite Reiter erfährt die Fassung, die wirklich in der Datenbank steht");

    const gelesen = await terra.holeInWelt("terra-test", karte.id);
    assert.deepEqual(gelesen?.daten, BAUM_B, "der Stand des ersten Reiters steht noch");
    assert.equal(gelesen?.version, 2, "ein abgelehnter Schreibvorgang zählt nicht hoch");
  });

  it("nach dem Konflikt gelingt dasselbe Schreiben mit der neuen Fassung", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Nachziehen", daten: BAUM_A });
    await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 1 });

    const abgelehnt = await terra.speichere("terra-test", karte.id, { daten: BAUM_A, erwarteteVersion: 1 });
    assert.equal(abgelehnt.ok, false);

    const angenommen = await terra.speichere("terra-test", karte.id, { daten: BAUM_A, erwarteteVersion: 2 });
    assert.deepEqual(angenommen, { ok: true, version: 3 });
  });

  it("eine gelöschte Karte meldet unbekannt, nicht Konflikt", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Weg damit", daten: BAUM_A });
    assert.equal(await terra.loesche("terra-test", karte.id), true);
    const ergebnis = await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 1 });
    assert.deepEqual(ergebnis, { ok: false, grund: "unbekannt" });
  });

  it("der Titel reist beim Speichern optional mit", async () => {
    const karte = await terra.erstelle("terra-test", { titel: "Alt", daten: BAUM_A });
    await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 1 });
    assert.equal((await terra.holeInWelt("terra-test", karte.id))?.titel, "Alt",
      "ohne Titel im Aufruf bleibt der alte stehen");

    await terra.speichere("terra-test", karte.id, { daten: BAUM_B, erwarteteVersion: 2, titel: "Neu" });
    assert.equal((await terra.holeInWelt("terra-test", karte.id))?.titel, "Neu");
  });
});

describe("createTerraService — Weltlöschung", () => {
  it("Karten verschwinden mit ihrer Welt (onDelete: Cascade)", async () => {
    const welt = await db.world.create({ data: { name: "Terra Wegwerfwelt", slug: "terra-weg" } });
    const karte = await terra.erstelle("terra-weg", { titel: "Verschwindet", daten: BAUM_A });
    await db.world.delete({ where: { id: welt.id } });
    assert.equal(await db.terraKarte.findUnique({ where: { id: karte.id } }), null);
  });
});
