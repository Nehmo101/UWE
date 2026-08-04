"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { actionError } from "@/src/lib/api-response";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";
import { getCurrentAuthUser } from "@/src/lib/auth";

/**
 * Terra — Server Actions für den Karteneditor.
 *
 * Jede schreibende Action prüft dasselbe Trio, in dieser Reihenfolge:
 *
 *   1. `requireStudioActionAuth()`      — CSRF/Origin (Middleware allein genügt nicht)
 *   2. `requireStudioWorldEdit(slug)`   — Rolle owner/admin/dm auf DIESER Welt
 *   3. Mandantenprüfung über den Service — gehört die Karte zu DIESER Welt?
 *
 * Der dritte Guard steckt in `@uwe/database/terra`: jede Methode dort nimmt
 * den `worldSlug` entgegen und schreibt mit `worldId` im `where`. Es gibt
 * hier bewusst keinen Weg, eine Karte über ihre Id allein anzufassen — eine
 * Id aus einer fremden Welt darf nicht dadurch gültig werden, dass sie
 * existiert.
 *
 * Terra-Inhalte sind vollständig spielersichtbar (Owner-Entscheid 2026-07-21,
 * unverändert für Terra übernommen), es gibt deshalb keine Sichtbarkeitslogik.
 *
 * Seit J5 bauen auch Spieler Karten (im Portal, siehe
 * `apps/portal/app/terra-actions.ts`). Für die Actions hier ändert das nichts
 * an den Rechten — der Spielleiter darf jede Karte seiner Welt anfassen,
 * gleich wer sie gebaut hat. Dazu kommen zwei neue Actions, die es vorher
 * nicht brauchte: `gibTerraKarteFrei` und `weiseTerraKarteZurueck`.
 *
 * Woher die Daten kommen: aus dem gleich-origin <iframe> über die
 * postMessage-Brücke (`terra/src/editor/bruecke.js`). Der Frame besitzt keine
 * Route und keine Sitzung; er kann nur Nachrichten schicken, die die
 * Elternkomponente entgegennimmt und hier gegen die vollen Guards prüfen lässt.
 *
 * DATENBANK: der geteilte Client (`prisma`), nicht `createPrismaClient()`.
 * Der Unterschied ist kein Stilfrage — diese Datei hat ihn zweimal falsch
 * gehabt:
 *
 *   1. Jede Action baute ihre EIGENE SQLite-Verbindung auf. Die Fabrik warnt
 *      davor an ihrer eigenen Definition („avoids lock storms from per-request
 *      clients"); SQLite serialisiert Schreiber, und vier Verbindungen je
 *      Bedienschritt konkurrieren um dieselbe Sperre.
 *   2. Keine davon wurde je getrennt. Jeder Speichervorgang, jedes Umbenennen,
 *      jedes Löschen liess eine offene Verbindung zurück — ein Leck, das mit
 *      der Sitzungsdauer waechst. Gefunden im e2e-Lauf: zwei „Neue Karte"
 *      kurz hintereinander blockierten sich ueber zwanzig Sekunden.
 *
 * Der geteilte Client behebt beides auf einmal: eine Verbindung je Prozess,
 * nichts zu trennen, nichts zu lecken. Und weil er beim Modulstart entsteht,
 * sind seine Pragmas (WAL, busy_timeout) laengst gesetzt, wenn die erste
 * Anfrage eintrifft — bei einem frisch erzeugten Client sind sie das
 * nachweislich NICHT (siehe whenPragmasApplied in packages/database).
 */

export interface TerraSpeichernErgebnis {
  ok: boolean;
  /** Neue Zeilenversion nach dem Schreiben — geht über die Brücke zurück. */
  version?: number;
  /** true, wenn jemand anders inzwischen gespeichert hat. */
  konflikt?: boolean;
  error?: string;
}

export interface TerraKarteErgebnis {
  ok: boolean;
  karteId?: string;
  error?: string;
}

/** Höchstgröße eines Kartenbaums als JSON-Text. Über der Payload-Grenze der
 *  Server Actions (15 MB) wäre die Meldung sonst ein 413 ohne Erklärung. */
const DATEN_MAX = 12 * 1024 * 1024;

/**
 * Speichert den ganzen Kartenbaum. Konflikterkennung über die mitreisende
 * Version: Wer auf einem veralteten Stand gearbeitet hat, überschreibt nicht,
 * sondern bekommt `konflikt: true` und die Version zurück, die wirklich in der
 * Datenbank steht.
 *
 * Kein `revalidatePath` — der Editor besitzt die laufende Szene, ein Remount
 * würde die Kamera zurücksetzen.
 */
export async function speichereTerraKarteAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const roh = String(formData.get("daten") ?? "");
    if (!roh) throw new Error("Keine Kartendaten übermittelt");
    if (roh.length > DATEN_MAX) {
      throw new Error("Die Karte ist zu groß zum Speichern (über 12 MB). Bitte Höhenbild-Importe verkleinern.");
    }
    const daten: unknown = JSON.parse(roh);
    if (!daten || typeof daten !== "object" || Array.isArray(daten)) {
      throw new Error("Kartendaten sind kein Objekt");
    }

    const erwarteteVersion = Number(formData.get("version"));
    if (!Number.isInteger(erwarteteVersion) || erwarteteVersion < 1) {
      throw new Error("Ungültige Kartenversion");
    }

    const titelRoh = formData.get("titel");
    const terra = createTerraService(prisma);
    const ergebnis = await terra.speichere(worldSlug, karteId, {
      daten,
      erwarteteVersion,
      titel: titelRoh === null ? undefined : String(titelRoh),
    });

    if (ergebnis.ok) return { ok: true, version: ergebnis.version };
    if (ergebnis.grund === "konflikt") {
      return {
        ok: false,
        konflikt: true,
        version: ergebnis.version,
        error: "Diese Karte wurde inzwischen an anderer Stelle gespeichert. Bitte die Seite neu laden.",
      };
    }
    return { ok: false, error: "Karte gehört nicht zu dieser Welt" };
  } catch (error) {
    return actionError(error, "Speichern fehlgeschlagen");
  }
}

/** Legt eine leere Karte an. Der Editor füllt sie beim ersten Speichern. */
export async function erstelleTerraKarteAction(formData: FormData): Promise<TerraKarteErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  try {
    const terra = createTerraService(prisma);
    const karte = await terra.erstelle(worldSlug, { titel: String(formData.get("titel") ?? "") });
    revalidatePath(`/worlds/${worldSlug}/karten`);
    return { ok: true, karteId: karte.id };
  } catch (error) {
    return actionError(error, "Anlegen fehlgeschlagen");
  }
}

/** Benennt eine Karte um, ohne den Baum anzufassen. */
export async function benenneTerraKarteAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const terra = createTerraService(prisma);
    const ok = await terra.benenne(worldSlug, karteId, String(formData.get("titel") ?? ""));
    if (!ok) throw new Error("Karte gehört nicht zu dieser Welt");
    revalidatePath(`/worlds/${worldSlug}/karten`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Umbenennen fehlgeschlagen");
  }
}

/** Löscht eine Karte samt Baum. Unwiderruflich — die Bestätigung sitzt in der UI. */
export async function loescheTerraKarteAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const terra = createTerraService(prisma);
    const ok = await terra.loesche(worldSlug, karteId);
    if (!ok) throw new Error("Karte gehört nicht zu dieser Welt");
    revalidatePath(`/worlds/${worldSlug}/karten`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Löschen fehlgeschlagen");
  }
}

/* --- J5: Abnahme von Spielerkarten ------------------------------------- */

/**
 * Nimmt eine Karte ab. Sie wird damit Weltinhalt wie jede andere — im Portal
 * für alle Weltmitglieder sichtbar, für ihren Autor nicht mehr beschreibbar.
 *
 * Der Autor bleibt an der Karte vermerkt. Wer sie gebaut hat, ist Teil der
 * Welt-Geschichte und nicht bloss eine Durchgangsstation.
 */
export async function gibTerraKarteFreiAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const user = await getCurrentAuthUser();
    const terra = createTerraService(prisma);
    const ok = await terra.gibFrei(worldSlug, karteId, user?.id ?? null);
    if (!ok) throw new Error("Karte gehört nicht zu dieser Welt");
    revalidatePath(`/worlds/${worldSlug}/karten`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Freigeben fehlgeschlagen");
  }
}

/**
 * Gibt eine Spielerkarte an ihren Autor zurück — mit Rückmeldung, die er im
 * Portal über seinem Entwurf liest.
 *
 * Nur bei Karten mit Autor: eine im Studio angelegte Karte hat niemanden, an
 * den sie zurückgehen könnte. Der Service setzt diese Grenze im `where`.
 */
export async function weiseTerraKarteZurueckAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const user = await getCurrentAuthUser();
    const terra = createTerraService(prisma);
    const ok = await terra.weiseZurueck(worldSlug, karteId, {
      entschiedenVonUserId: user?.id ?? null,
      rueckmeldung: String(formData.get("rueckmeldung") ?? ""),
    });
    if (!ok) throw new Error("Diese Karte lässt sich nicht zurückgeben — sie hat keinen Spieler-Autor");
    revalidatePath(`/worlds/${worldSlug}/karten`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Zurückgeben fehlgeschlagen");
  }
}
