import { Prisma } from "./generated/prisma/client";
import type { TerraKarte } from "./generated/prisma/client";
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
 * Sichtbarkeit je Karte gibt es nicht: Karten sind vollständig
 * spielersichtbar, der Zugriff hängt allein an der Weltmitgliedschaft. Die
 * Rechteprüfung liegt vor diesem Modul (Studio-Guards, Portal-Weltlogin) —
 * dieser Service prüft ausschließlich die MANDANTENGRENZE (`worldId`), damit
 * eine Karten-Id aus einer fremden Welt nie ausgeliefert wird.
 */

/** Höchstlänge eines Kartentitels. Terra selbst kennt keine Grenze. */
const TITEL_MAX = 120;

export interface TerraKarteKopf {
  id: string;
  titel: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TerraSpeicherErgebnis =
  | { ok: true; version: number }
  | { ok: false; grund: "konflikt"; version: number }
  | { ok: false; grund: "unbekannt" };

function titelGeputzt(roh: unknown, ersatz = "Karte"): string {
  const text = typeof roh === "string" ? roh.trim() : "";
  return (text || ersatz).slice(0, TITEL_MAX);
}

export function createTerraService(db: PrismaClient) {
  async function requireWorldBySlug(worldSlug: string) {
    const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true, name: true } });
    if (!world) throw new Error(`world not found: ${worldSlug}`);
    return world;
  }

  /** Alle Karten einer Welt — ohne `daten`, für Listen und Navigation. */
  async function listeFuerWelt(worldSlug: string): Promise<TerraKarteKopf[]> {
    const world = await requireWorldBySlug(worldSlug);
    return db.terraKarte.findMany({
      where: { worldId: world.id },
      orderBy: [{ createdAt: "asc" }],
      select: { id: true, titel: true, version: true, createdAt: true, updatedAt: true },
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
    const world = await requireWorldBySlug(worldSlug);
    const daten = eingabe.daten as Prisma.InputJsonValue;
    const geschrieben = await db.terraKarte.updateMany({
      where: { id: karteId, worldId: world.id, version: eingabe.erwarteteVersion },
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
      select: { worldId: true, version: true },
    });
    if (!aktuell || aktuell.worldId !== world.id) return { ok: false, grund: "unbekannt" };
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

  return { listeFuerWelt, holeInWelt, erstelle, speichere, loesche, benenne };
}

export type TerraService = ReturnType<typeof createTerraService>;
