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
 *
 * Seit J5 kommt eine dritte dazu, aus demselben Grund und mit derselben
 * Bauart: die AUTOR- und ZUSTANDSGRENZE der Karten aus dem Portal. Ein Spieler
 * fasst nur seine eigene Karte an, und nur solange sie ein Entwurf ist. Beides
 * steht im `where`, nicht in einer Prüfung davor — die Tests unten reichen
 * deshalb absichtlich fremde Ids und falsche Zustände ein und sehen nach, dass
 * die Daten unberührt bleiben.
 */

let db: PrismaClient;
let terra: TerraService;
/** Zwei Spieler und ein Spielleiter — für die Autorgrenze braucht es echte Ids. */
let spielerA: string;
let spielerB: string;
let spielleiter: string;

const BAUM_A = { format: "terra", version: 5, wurzel: "k0", karten: [{ id: "k0", elternId: null }] };
const BAUM_B = { format: "terra", version: 5, wurzel: "k0", karten: [{ id: "k0", elternId: null, titel: "B" }] };

before(async () => {
  db = createPrismaClient(createTestDatabaseUrl());
  terra = createTerraService(db);
  await db.world.create({ data: { name: "Terra Test World", slug: "terra-test" } });
  await db.world.create({ data: { name: "Terra Fremde Welt", slug: "terra-fremd" } });
  await db.world.create({ data: { name: "Terra Portalwelt", slug: "terra-portal" } });

  spielerA = (await db.user.create({ data: { displayName: "Spieler A", email: "a@terra.test" } })).id;
  spielerB = (await db.user.create({ data: { displayName: "Spieler B", email: "b@terra.test" } })).id;
  spielleiter = (await db.user.create({ data: { displayName: "Spielleiter", email: "dm@terra.test" } })).id;
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

/* ==========================================================================
   J5 — Karten aus dem Portal
   ========================================================================== */

async function entwurfVon(autorUserId: string, titel = "Spielerkarte") {
  return terra.erstelleSpielerEntwurf("terra-portal", {
    titel,
    daten: BAUM_A,
    autorUserId,
    autorName: "Thalia",
  });
}

describe("createTerraService — Herkunft und Vorgabezustand", () => {
  it("eine im Studio angelegte Karte ist sofort freigegeben und hat keinen Autor", async () => {
    // Der Vorgabewert der Spalte. Er hängt an Bestandsdaten: hieße er
    // `entwurf`, wären alle Karten von vor J5 aus dem Portal verschwunden.
    const karte = await terra.erstelle("terra-portal", { titel: "DM-Karte", daten: BAUM_A });
    assert.equal(karte.status, "freigegeben");
    assert.equal(karte.autorUserId, null);
  });

  it("eine im Portal angelegte Karte ist ein Entwurf und trägt ihren Autor", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(karte.status, "entwurf");
    assert.equal(karte.autorUserId, spielerA);
    assert.equal(karte.autorName, "Thalia");
  });
});

describe("createTerraService — Spielersicht", () => {
  it("listeFuerSpieler zeigt Abgenommenes plus die eigenen Entwürfe, keine fremden", async () => {
    const welt = "terra-sicht";
    await db.world.create({ data: { name: "Terra Sichtwelt", slug: welt } });
    const abgenommen = await terra.erstelle(welt, { titel: "Weltkarte", daten: BAUM_A });
    const meiner = await terra.erstelleSpielerEntwurf(welt, { titel: "Meiner", autorUserId: spielerA });
    const fremder = await terra.erstelleSpielerEntwurf(welt, { titel: "Fremder", autorUserId: spielerB });

    const fuerA = (await terra.listeFuerSpieler(welt, spielerA)).map((eintrag) => eintrag.id);
    assert.deepEqual(fuerA.sort(), [abgenommen.id, meiner.id].sort());
    assert.equal(fuerA.includes(fremder.id), false, "ein fremder Entwurf taucht nicht auf");

    // Der Spielleiter im Studio sieht dagegen alles — sonst könnte er nichts abnehmen.
    const imStudio = (await terra.listeFuerWelt(welt)).map((eintrag) => eintrag.id);
    assert.equal(imStudio.length, 3);
  });

  it("ohne angemeldeten Autor (Vorschau) bleibt nur Abgenommenes", async () => {
    const welt = "terra-vorschau";
    await db.world.create({ data: { name: "Terra Vorschauwelt", slug: welt } });
    const abgenommen = await terra.erstelle(welt, { titel: "Weltkarte", daten: BAUM_A });
    await terra.erstelleSpielerEntwurf(welt, { titel: "Entwurf", autorUserId: spielerA });

    const liste = await terra.listeFuerSpieler(welt, null);
    assert.deepEqual(liste.map((eintrag) => eintrag.id), [abgenommen.id]);
  });

  it("holeFuerSpieler verweigert den fremden Entwurf, gibt den eigenen heraus", async () => {
    const karte = await entwurfVon(spielerA);
    assert.ok(await terra.holeFuerSpieler("terra-portal", karte.id, spielerA));
    assert.equal(await terra.holeFuerSpieler("terra-portal", karte.id, spielerB), null);
    assert.equal(await terra.holeFuerSpieler("terra-portal", karte.id, null), null);
  });

  it("nach der Abnahme ist dieselbe Karte für alle da", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.gibFrei("terra-portal", karte.id, spielleiter), true);
    assert.ok(await terra.holeFuerSpieler("terra-portal", karte.id, spielerB));
    assert.ok(await terra.holeFuerSpieler("terra-portal", karte.id, null));
  });
});

describe("createTerraService — Autor- und Zustandsgrenze beim Schreiben", () => {
  it("der Autor speichert in seinen Entwurf", async () => {
    const karte = await entwurfVon(spielerA);
    const ergebnis = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.deepEqual(ergebnis, { ok: true, version: 2 });
    assert.deepEqual((await terra.holeInWelt("terra-portal", karte.id))?.daten, BAUM_B);
  });

  it("ein anderer Spieler schreibt nicht hinein — und erfährt keine Fassung", async () => {
    const karte = await entwurfVon(spielerA);
    const ergebnis = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerB,
    });
    // Nicht `konflikt`: das wäre eine Einladung, es mit neuer Fassung erneut
    // zu versuchen — und die Fassungszahl selbst wäre schon eine Auskunft.
    assert.deepEqual(ergebnis, { ok: false, grund: "unbekannt" });
    assert.deepEqual((await terra.holeInWelt("terra-portal", karte.id))?.daten, BAUM_A, "der Baum ist unberührt");
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.version, 1);
  });

  it("nach dem Einreichen schreibt auch der Autor nicht mehr", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.reicheEin("terra-portal", karte.id, spielerA), true);

    const ergebnis = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.deepEqual(ergebnis, { ok: false, grund: "unbekannt" });
    assert.deepEqual((await terra.holeInWelt("terra-portal", karte.id))?.daten, BAUM_A);
  });

  it("nach der Abnahme schreibt der Autor nicht mehr — das Studio schon", async () => {
    const karte = await entwurfVon(spielerA);
    await terra.gibFrei("terra-portal", karte.id, spielleiter);

    const ausDemPortal = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.deepEqual(ausDemPortal, { ok: false, grund: "unbekannt" });

    // `speichere` (Studio) kennt die Zustandsgrenze nicht: der Spielleiter
    // darf jede Karte seiner Welt anfassen.
    const ausDemStudio = await terra.speichere("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
    });
    assert.deepEqual(ausDemStudio, { ok: true, version: 2 });
  });

  it("die Konflikterkennung bleibt beim eigenen Entwurf erhalten", async () => {
    const karte = await entwurfVon(spielerA);
    await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    const veraltet = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_A,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.deepEqual(veraltet, { ok: false, grund: "konflikt", version: 2 });
  });

  it("die Weltgrenze steht auch für den Autor", async () => {
    const karte = await entwurfVon(spielerA);
    const ergebnis = await terra.speichereEntwurf("terra-fremd", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.deepEqual(ergebnis, { ok: false, grund: "unbekannt" });
  });

  it("benenneEntwurf und loescheEigenenEntwurf greifen nicht über die Autorgrenze", async () => {
    const karte = await entwurfVon(spielerA, "Bleibt so");
    assert.equal(await terra.benenneEntwurf("terra-portal", karte.id, spielerB, "Gekapert"), false);
    assert.equal(await terra.loescheEigenenEntwurf("terra-portal", karte.id, spielerB), false);
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.titel, "Bleibt so");

    assert.equal(await terra.benenneEntwurf("terra-portal", karte.id, spielerA, "Neuer Name"), true);
    assert.equal(await terra.loescheEigenenEntwurf("terra-portal", karte.id, spielerA), true);
  });

  it("eine abgenommene Karte löscht der Autor nicht mehr", async () => {
    const karte = await entwurfVon(spielerA);
    await terra.gibFrei("terra-portal", karte.id, spielleiter);
    assert.equal(await terra.loescheEigenenEntwurf("terra-portal", karte.id, spielerA), false);
    assert.ok(await terra.holeInWelt("terra-portal", karte.id), "die Karte gehört jetzt der Welt");
  });
});

describe("createTerraService — Einreichen und Abnahme", () => {
  it("Einreichen setzt den Zeitpunkt und sperrt das Schreiben; Zurückziehen hebt beides auf", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.reicheEin("terra-portal", karte.id, spielerA), true);

    const eingereicht = await terra.holeInWelt("terra-portal", karte.id);
    assert.equal(eingereicht?.status, "eingereicht");
    assert.ok(eingereicht?.eingereichtAm instanceof Date);

    assert.equal(await terra.ziehZurueck("terra-portal", karte.id, spielerA), true);
    const zurueck = await terra.holeInWelt("terra-portal", karte.id);
    assert.equal(zurueck?.status, "entwurf");
    assert.equal(zurueck?.eingereichtAm, null);

    // Und danach lässt sich wieder schreiben.
    const ergebnis = await terra.speichereEntwurf("terra-portal", karte.id, {
      daten: BAUM_B,
      erwarteteVersion: 1,
      autorUserId: spielerA,
    });
    assert.equal(ergebnis.ok, true);
  });

  it("ein fremder Spieler reicht nicht ein und zieht nicht zurück", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.reicheEin("terra-portal", karte.id, spielerB), false);
    await terra.reicheEin("terra-portal", karte.id, spielerA);
    assert.equal(await terra.ziehZurueck("terra-portal", karte.id, spielerB), false);
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.status, "eingereicht");
  });

  it("Zurückgeben trägt die Rückmeldung ein; das nächste Einreichen räumt sie weg", async () => {
    const karte = await entwurfVon(spielerA);
    await terra.reicheEin("terra-portal", karte.id, spielerA);

    assert.equal(
      await terra.weiseZurueck("terra-portal", karte.id, {
        entschiedenVonUserId: spielleiter,
        rueckmeldung: "  Der Fluss läuft bergauf.  ",
      }),
      true,
    );
    const zurueck = await terra.holeInWelt("terra-portal", karte.id);
    assert.equal(zurueck?.status, "entwurf");
    assert.equal(zurueck?.rueckmeldung, "Der Fluss läuft bergauf.", "getrimmt");
    assert.equal(zurueck?.entschiedenVonUserId, spielleiter);

    // Die alte Rückmeldung gehört zur alten Fassung — sie darf dem
    // Spielleiter nicht neben der neuen stehenbleiben.
    await terra.reicheEin("terra-portal", karte.id, spielerA);
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.rueckmeldung, null);
  });

  it("eine Studio-Karte lässt sich nicht zurückgeben — es gibt niemanden dafür", async () => {
    const karte = await terra.erstelle("terra-portal", { titel: "DM-eigen", daten: BAUM_A });
    assert.equal(
      await terra.weiseZurueck("terra-portal", karte.id, {
        entschiedenVonUserId: spielleiter,
        rueckmeldung: "geht nicht",
      }),
      false,
    );
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.status, "freigegeben");
  });

  it("Abnahme und Zurückgabe greifen nicht über die Weltgrenze", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.gibFrei("terra-fremd", karte.id, spielleiter), false);
    assert.equal(
      await terra.weiseZurueck("terra-fremd", karte.id, { entschiedenVonUserId: spielleiter }),
      false,
    );
    assert.equal((await terra.holeInWelt("terra-portal", karte.id))?.status, "entwurf");
  });

  it("der Spielleiter darf direkt aus dem Entwurf abnehmen, ohne aufs Einreichen zu warten", async () => {
    const karte = await entwurfVon(spielerA);
    assert.equal(await terra.gibFrei("terra-portal", karte.id, spielleiter), true);
    const abgenommen = await terra.holeInWelt("terra-portal", karte.id);
    assert.equal(abgenommen?.status, "freigegeben");
    assert.ok(abgenommen?.entschiedenAm instanceof Date);
    assert.equal(abgenommen?.autorUserId, spielerA, "der Autor bleibt vermerkt");
  });
});
