import { Prisma } from "./generated/prisma/client";
import type { TerraKarte, TerraKarteStatus } from "./generated/prisma/client";
import type { PrismaClient } from "./client";

/**
 * Terra-Karten — Datenzugriff für den Karteneditor.
 *
 * Bewusst dünn. Terra speichert eine Karte als EINE JSON-Datei im Format v5
 * (`terra/src/world/kartenbaum.js`): der Baum trägt alle Ebenen in sich. Es
 * gibt deshalb nichts zu normalisieren und nichts teilweise zu schreiben —
 * jeder Speichervorgang ersetzt `daten` vollständig — eine „replace all"-
 * Zusage auf einem einzigen Feld.
 *
 * Sichtbarkeit je Karte gibt es nicht: abgenommene Karten sind vollständig
 * spielersichtbar, der Zugriff hängt allein an der Weltmitgliedschaft. Die
 * Rechteprüfung liegt vor diesem Modul (Studio-Guards, Portal-Weltlogin) —
 * dieser Service prüft ausschließlich die MANDANTENGRENZE (`worldId`), damit
 * eine Karten-Id aus einer fremden Welt nie ausgeliefert wird.
 *
 * ------------------------------------------------------------------------
 * J5 — KARTEN AUS DEM PORTAL
 *
 * Seit dieser Runde bauen auch Spieler Karten, im selben Editor und ohne
 * Einschränkung im Werkzeug. Was sie bauen, ist bis zur Abnahme durch den
 * Spielleiter ein ENTWURF. Daraus folgen genau zwei zusätzliche Grenzen —
 * beide stehen im `where` eines einzigen Schreibvorgangs, nie als getrennte
 * Lesen-dann-Schreiben-Folge:
 *
 *   AUTORGRENZE   `autorUserId` — ein Spieler fasst nur seine eigene Karte an.
 *   ZUSTANDSGRENZE `status`     — geschrieben wird nur an einem `entwurf`.
 *                                 Eingereichtes und Abgenommenes ist für den
 *                                 Spieler zu; dort schreibt nur noch das
 *                                 Studio.
 *
 * Warum atomar und nicht „erst prüfen, dann schreiben": zwischen zwei
 * Anweisungen kann der Spielleiter abnehmen. Ein Spieler würde sonst in eine
 * Karte schreiben, die in dem Moment schon freigegeben war — der Klassiker
 * TOCTOU, hier mit einem sehr realen Zeitfenster (Autosave alle 1,2 s).
 *
 * Der Vorgabewert des Zustands ist `freigegeben`, nicht `entwurf`. Das ist
 * kein Versehen: eine im Studio angelegte Karte gehört dem Spielleiter und
 * braucht keine Abnahme durch sich selbst, und alle Zeilen von vor dieser
 * Runde bleiben dadurch sichtbar. Den engeren Zustand setzt allein
 * `erstelleSpielerEntwurf`.
 */

/** Höchstlänge eines Kartentitels. Terra selbst kennt keine Grenze. */
const TITEL_MAX = 120;

/** Höchstlänge einer Rückmeldung des Spielleiters beim Zurückgeben. */
const RUECKMELDUNG_MAX = 2000;

/** Höchstlänge des mitgeführten Autorennamens. */
const AUTORNAME_MAX = 120;

export interface TerraKarteKopf {
  id: string;
  titel: string;
  version: number;
  status: TerraKarteStatus;
  /** `null` = im Studio entstanden, es gibt keinen Spieler-Autor. */
  autorUserId: string | null;
  autorName: string | null;
  eingereichtAm: Date | null;
  rueckmeldung: string | null;
  /** Sperre des Spielleiters — im Portal ist die Karte dann nur noch lesbar. */
  gesperrt: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Auswahl für Listenköpfe — an EINER Stelle, damit keine Liste ein Feld verliert. */
const KOPF_AUSWAHL = {
  id: true,
  titel: true,
  version: true,
  status: true,
  autorUserId: true,
  autorName: true,
  eingereichtAm: true,
  rueckmeldung: true,
  gesperrt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TerraSpeicherErgebnis =
  | { ok: true; version: number }
  | { ok: false; grund: "konflikt"; version: number }
  | { ok: false; grund: "gesperrt" }
  | { ok: false; grund: "unbekannt" };

function titelGeputzt(roh: unknown, ersatz = "Karte"): string {
  const text = typeof roh === "string" ? roh.trim() : "";
  return (text || ersatz).slice(0, TITEL_MAX);
}

function textGeputzt(roh: unknown, max: number): string | null {
  const text = typeof roh === "string" ? roh.trim() : "";
  return text ? text.slice(0, max) : null;
}

export function createTerraService(db: PrismaClient) {
  async function requireWorldBySlug(worldSlug: string) {
    const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true, name: true } });
    if (!world) throw new Error(`world not found: ${worldSlug}`);
    return world;
  }

  /**
   * Alle Karten einer Welt — ohne `daten`, für Listen und Navigation.
   *
   * Ungefiltert, weil der einzige Aufrufer das Studio ist: der Spielleiter
   * soll Entwürfe seiner Spieler sehen, sonst könnte er sie nicht abnehmen.
   * Für das Portal gibt es `listeFuerSpieler`.
   */
  async function listeFuerWelt(worldSlug: string): Promise<TerraKarteKopf[]> {
    const world = await requireWorldBySlug(worldSlug);
    return db.terraKarte.findMany({
      where: { worldId: world.id },
      orderBy: [{ createdAt: "asc" }],
      select: KOPF_AUSWAHL,
    });
  }

  /**
   * Die Karten, die ein Spieler im Portal sehen darf: alles Abgenommene der
   * Welt plus die eigenen, noch nicht abgenommenen Karten.
   *
   * Fremde Entwürfe fehlen hier bewusst — nicht weil sie geheim wären,
   * sondern weil sie noch niemand abgenommen hat. Was im Portal steht, ist
   * geprüfter Weltinhalt; ein halbfertiger Entwurf eines Mitspielers ist das
   * nicht.
   *
   * `autorUserId === null` (Vorschau-Modus, kein angemeldeter Autor) liefert
   * ausschließlich Abgenommenes. Der OR-Zweig fällt dann ganz weg, statt auf
   * `autorUserId: null` zu prüfen — sonst bekäme die Vorschau die
   * Studio-Karten als „eigene" untergeschoben.
   */
  async function listeFuerSpieler(worldSlug: string, autorUserId: string | null): Promise<TerraKarteKopf[]> {
    const world = await requireWorldBySlug(worldSlug);
    return db.terraKarte.findMany({
      where: {
        worldId: world.id,
        ...(autorUserId
          ? { OR: [{ status: "freigegeben" }, { autorUserId }] }
          : { status: "freigegeben" }),
      },
      orderBy: [{ createdAt: "asc" }],
      select: KOPF_AUSWAHL,
    });
  }

  /**
   * Eine Karte MIT Mandantenprüfung. Liefert `null`, wenn es die Karte nicht
   * gibt ODER sie zu einer anderen Welt gehört — der Aufrufer kann beides
   * gleich behandeln (`notFound()`), ohne die Existenz fremder Karten zu
   * verraten.
   */
  async function holeInWelt(worldSlug: string, karteId: string): Promise<TerraKarte | null> {
    const world = await requireWorldBySlug(worldSlug);
    const karte = await db.terraKarte.findUnique({ where: { id: karteId } });
    if (!karte || karte.worldId !== world.id) return null;
    return karte;
  }

  /**
   * Wie {@link holeInWelt}, aber mit der Spielersicht davor: abgenommen ODER
   * die eigene Karte. Ein fremder Entwurf liefert `null` — dieselbe Antwort
   * wie eine Karte aus einer fremden Welt, damit der Aufrufer beides gleich
   * behandeln kann (`notFound()`) und nichts über ihre Existenz verrät.
   */
  async function holeFuerSpieler(
    worldSlug: string,
    karteId: string,
    autorUserId: string | null,
  ): Promise<TerraKarte | null> {
    const karte = await holeInWelt(worldSlug, karteId);
    if (!karte) return null;
    if (karte.status === "freigegeben") return karte;
    return autorUserId !== null && karte.autorUserId === autorUserId ? karte : null;
  }

  async function erstelle(worldSlug: string, eingabe: { titel?: string; daten?: unknown }): Promise<TerraKarte> {
    const world = await requireWorldBySlug(worldSlug);
    return db.terraKarte.create({
      data: {
        worldId: world.id,
        titel: titelGeputzt(eingabe.titel),
        // Eine frische Karte trägt noch keinen Baum: der Editor startet mit
        // seiner eigenen Vorgabe und meldet den ersten Stand selbst heraus.
        daten: (eingabe.daten ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Speichert den ganzen Kartenbaum — mit Konflikterkennung.
   *
   * `erwarteteVersion` ist die Version, auf der der Schreiber gearbeitet hat.
   * Der Vergleich läuft im `where` des `updateMany`, nicht als vorheriges
   * `findUnique`: nur so ist „prüfen und schreiben" ein einziger, atomarer
   * Schritt. Zwei gleichzeitige Reiter überschreiben sich damit nicht mehr
   * gegenseitig — der zweite bekommt `konflikt` zurück und die Version, die
   * gerade wirklich in der Datenbank steht.
   */
  async function speichere(
    worldSlug: string,
    karteId: string,
    eingabe: { daten: unknown; titel?: string; erwarteteVersion: number },
  ): Promise<TerraSpeicherErgebnis> {
    return schreibeBaum(worldSlug, karteId, eingabe, {});
  }

  /**
   * Der gemeinsame Schreibvorgang hinter {@link speichere} und
   * {@link speichereEntwurf}. `zusatz` verengt das `where` weiter (Autor,
   * Zustand) — es ergänzt die Prüfung, es ersetzt sie nie: Welt und Version
   * stehen fest in dieser Funktion.
   */
  async function schreibeBaum(
    worldSlug: string,
    karteId: string,
    eingabe: { daten: unknown; titel?: string; erwarteteVersion: number },
    zusatz: Prisma.TerraKarteWhereInput,
  ): Promise<TerraSpeicherErgebnis> {
    const world = await requireWorldBySlug(worldSlug);
    const daten = eingabe.daten as Prisma.InputJsonValue;
    const geschrieben = await db.terraKarte.updateMany({
      where: { ...zusatz, id: karteId, worldId: world.id, version: eingabe.erwarteteVersion },
      data: {
        daten,
        ...(eingabe.titel === undefined ? {} : { titel: titelGeputzt(eingabe.titel) }),
        version: { increment: 1 },
      },
    });
    if (geschrieben.count === 1) return { ok: true, version: eingabe.erwarteteVersion + 1 };

    // Nichts geschrieben: entweder ist die Version veraltet (Konflikt) oder
    // die Karte gehört gar nicht zu dieser Welt / gibt es nicht mehr.
    const aktuell = await db.terraKarte.findUnique({
      where: { id: karteId },
      select: { worldId: true, version: true, status: true, autorUserId: true, gesperrt: true },
    });
    if (!aktuell || aktuell.worldId !== world.id) return { ok: false, grund: "unbekannt" };
    // Autor- oder Zustandsgrenze verfehlt: das ist kein Konflikt, sondern
    // fehlendes Recht. „unbekannt" ist hier die richtige Antwort — sie sagt
    // nichts darüber, ob es die Karte gibt, und der Aufrufer soll nicht zum
    // Wiederholen mit neuer Fassung einladen.
    if (zusatz.status !== undefined && aktuell.status !== zusatz.status) {
      return { ok: false, grund: "unbekannt" };
    }
    if (zusatz.autorUserId !== undefined && aktuell.autorUserId !== zusatz.autorUserId) {
      return { ok: false, grund: "unbekannt" };
    }
    if (zusatz.gesperrt !== undefined && aktuell.gesperrt !== zusatz.gesperrt) {
      return { ok: false, grund: "gesperrt" };
    }
    return { ok: false, grund: "konflikt", version: aktuell.version };
  }

  /** Löscht eine Karte — nur innerhalb ihrer Welt. Liefert `false`, wenn nichts passte. */
  async function loesche(worldSlug: string, karteId: string): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const entfernt = await db.terraKarte.deleteMany({ where: { id: karteId, worldId: world.id } });
    return entfernt.count === 1;
  }

  /** Titel ändern, ohne den Baum anzufassen (die Liste im Studio nutzt das). */
  async function benenne(worldSlug: string, karteId: string, titel: string): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id },
      data: { titel: titelGeputzt(titel) },
    });
    return geaendert.count === 1;
  }

  /* --- J5: der Weg über das Portal ------------------------------------- */

  /**
   * Legt eine Karte an, die einem Spieler gehört und noch nicht abgenommen
   * ist. Getrennte Funktion statt eines Zusatzfeldes an {@link erstelle}, und
   * zwar aus einem einzigen Grund: der Vorgabewert des Zustands ist
   * `freigegeben`. Ein vergessenes Feld an einem gemeinsamen `erstelle` wäre
   * eine sofort veröffentlichte Spielerkarte — ein Fehler, den man erst
   * bemerkt, wenn sie bei allen anderen in der Liste steht.
   */
  async function erstelleSpielerEntwurf(
    worldSlug: string,
    eingabe: { titel?: string; daten?: unknown; autorUserId: string; autorName?: string },
  ): Promise<TerraKarte> {
    const world = await requireWorldBySlug(worldSlug);
    return db.terraKarte.create({
      data: {
        worldId: world.id,
        titel: titelGeputzt(eingabe.titel),
        daten: (eingabe.daten ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        status: "entwurf",
        autorUserId: eingabe.autorUserId,
        autorName: textGeputzt(eingabe.autorName, AUTORNAME_MAX),
      },
    });
  }

  /**
   * Speichern aus dem Portal. Wie {@link speichere}, aber nur am eigenen
   * Entwurf — Autor- und Zustandsgrenze reisen im selben `where` mit.
   */
  async function speichereEntwurf(
    worldSlug: string,
    karteId: string,
    eingabe: { daten: unknown; titel?: string; erwarteteVersion: number; autorUserId: string },
  ): Promise<TerraSpeicherErgebnis> {
    return schreibeBaum(worldSlug, karteId, eingabe, {
      autorUserId: eingabe.autorUserId,
      status: "entwurf",
      gesperrt: false,
    });
  }

  /** Titel des eigenen Entwurfs ändern. */
  async function benenneEntwurf(
    worldSlug: string,
    karteId: string,
    autorUserId: string,
    titel: string,
  ): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id, autorUserId, status: "entwurf", gesperrt: false },
      data: { titel: titelGeputzt(titel) },
    });
    return geaendert.count === 1;
  }

  /**
   * Der Spieler reicht seinen Entwurf zur Abnahme ein. Ab hier schreibt er
   * nicht mehr daran — die Zustandsgrenze macht das von selbst.
   *
   * Eine alte Rückmeldung wird dabei gelöscht: sie gehörte zur vorigen Runde,
   * und der Spielleiter soll die neue Fassung nicht mit dem Kommentar zur
   * alten vor sich haben.
   */
  async function reicheEin(worldSlug: string, karteId: string, autorUserId: string): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id, autorUserId, status: "entwurf", gesperrt: false },
      data: { status: "eingereicht", eingereichtAm: new Date(), rueckmeldung: null },
    });
    return geaendert.count === 1;
  }

  /** Der Spieler zieht die Einreichung zurück und arbeitet weiter. */
  async function ziehZurueck(worldSlug: string, karteId: string, autorUserId: string): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id, autorUserId, status: "eingereicht", gesperrt: false },
      data: { status: "entwurf", eingereichtAm: null },
    });
    return geaendert.count === 1;
  }

  /**
   * Der Spieler löscht seine eigene, noch nicht abgenommene Karte.
   *
   * Nach der Abnahme geht das nicht mehr: die Karte gehört dann der Welt, und
   * nur das Studio räumt Weltinhalt weg.
   */
  async function loescheEigenenEntwurf(
    worldSlug: string,
    karteId: string,
    autorUserId: string,
  ): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const entfernt = await db.terraKarte.deleteMany({
      where: {
        id: karteId,
        worldId: world.id,
        autorUserId,
        status: { in: ["entwurf", "eingereicht"] },
        gesperrt: false,
      },
    });
    return entfernt.count === 1;
  }

  /* --- J5: die Abnahme im Studio --------------------------------------- */

  /**
   * Sperre setzen oder loesen — der Haken im Studio.
   *
   * Eine gesperrte Karte ist im Portal nur noch lesbar: der Autor kann weder
   * speichern noch umbenennen, einreichen, zurueckziehen oder loeschen. Das
   * Studio schreibt weiter, denn die Sperre richtet sich an den Tisch, nicht
   * an den Spielleiter.
   *
   * Bewusst unabhaengig vom Zustand: auch ein Entwurf laesst sich sperren
   * („so bleibt sie jetzt stehen"), und eine abgenommene Karte laesst sich
   * entsperren, ohne sie zurueckzugeben.
   */
  async function setzeSperre(worldSlug: string, karteId: string, gesperrt: boolean): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id },
      data: { gesperrt },
    });
    return geaendert.count === 1;
  }

  /**
   * Der Spielleiter nimmt eine Karte ab. Sie wird damit Weltinhalt wie jede
   * andere Karte — der Autor bleibt vermerkt, schreibt aber nicht mehr.
   *
   * Ohne Zustandsbedingung im `where`: freigeben darf man aus jedem Zustand,
   * auch direkt aus dem Entwurf, wenn der Spielleiter nicht auf das Einreichen
   * warten will. Eine schon freigegebene Karte noch einmal freizugeben ist
   * folgenlos und meldet `true`.
   */
  async function gibFrei(
    worldSlug: string,
    karteId: string,
    entschiedenVonUserId: string | null,
  ): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id },
      data: {
        status: "freigegeben",
        entschiedenAm: new Date(),
        entschiedenVonUserId,
        rueckmeldung: null,
      },
    });
    return geaendert.count === 1;
  }

  /**
   * Der Spielleiter gibt eine Karte an ihren Autor zurück — mit Rückmeldung,
   * die der Spieler im Portal über seinem Entwurf liest.
   *
   * Nur bei Karten mit Autor: eine Studio-eigene Karte hat niemanden, an den
   * sie zurückgehen könnte.
   */
  async function weiseZurueck(
    worldSlug: string,
    karteId: string,
    eingabe: { entschiedenVonUserId: string | null; rueckmeldung?: string },
  ): Promise<boolean> {
    const world = await requireWorldBySlug(worldSlug);
    const geaendert = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id, autorUserId: { not: null } },
      data: {
        status: "entwurf",
        eingereichtAm: null,
        entschiedenAm: new Date(),
        entschiedenVonUserId: eingabe.entschiedenVonUserId,
        rueckmeldung: textGeputzt(eingabe.rueckmeldung, RUECKMELDUNG_MAX),
      },
    });
    return geaendert.count === 1;
  }

  return {
    listeFuerWelt,
    listeFuerSpieler,
    holeInWelt,
    holeFuerSpieler,
    erstelle,
    speichere,
    loesche,
    benenne,
    erstelleSpielerEntwurf,
    speichereEntwurf,
    benenneEntwurf,
    reicheEin,
    ziehZurueck,
    loescheEigenenEntwurf,
    gibFrei,
    weiseZurueck,
    setzeSperre,
  };
}

export type TerraService = ReturnType<typeof createTerraService>;
export type { TerraKarteStatus };
