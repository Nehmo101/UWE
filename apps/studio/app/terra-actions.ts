"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Terra — Server Actions für den Karteneditor, der Atlas 3D ablöst (J1).
 *
 * Jede schreibende Action prüft dasselbe Trio wie der Atlas-Bestand, in
 * dieser Reihenfolge:
 *
 *   1. `requireStudioActionAuth()`      — CSRF/Origin (Middleware allein genügt nicht)
 *   2. `requireStudioWorldEdit(slug)`   — Rolle owner/admin/dm auf DIESER Welt
 *   3. Mandantenprüfung über den Service — gehört die Karte zu DIESER Welt?
 *
 * Der dritte Guard steckt in `@uwe/database/terra`: jede Methode dort nimmt
 * den `worldSlug` entgegen und schreibt mit `worldId` im `where`. Es gibt
 * hier bewusst keinen Weg, eine Karte über ihre Id allein anzufassen — genau
 * das war die Falle, gegen die Atlas' `requireNodeInWorld` gebaut wurde.
 *
 * Terra-Inhalte sind vollständig spielersichtbar (Owner-Entscheid 2026-07-21,
 * unverändert für Terra übernommen), es gibt deshalb keine Sichtbarkeitslogik.
 *
 * Woher die Daten kommen: aus dem gleich-origin <iframe> über die
 * postMessage-Brücke (`terra/src/editor/bruecke.js`). Der Frame besitzt keine
 * Route und keine Sitzung; er kann nur Nachrichten schicken, die die
 * Elternkomponente entgegennimmt und hier gegen die vollen Guards prüfen lässt.
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
 * würde die Kamera zurücksetzen (dieselbe Begründung wie bei Atlas).
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
    const terra = createTerraService(createPrismaClient());
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
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/** Legt eine leere Karte an. Der Editor füllt sie beim ersten Speichern. */
export async function erstelleTerraKarteAction(formData: FormData): Promise<TerraKarteErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  try {
    const terra = createTerraService(createPrismaClient());
    const karte = await terra.erstelle(worldSlug, { titel: String(formData.get("titel") ?? "") });
    revalidatePath(`/worlds/${worldSlug}/atlas3d`);
    return { ok: true, karteId: karte.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Anlegen fehlgeschlagen" };
  }
}

/** Benennt eine Karte um, ohne den Baum anzufassen. */
export async function benenneTerraKarteAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const terra = createTerraService(createPrismaClient());
    const ok = await terra.benenne(worldSlug, karteId, String(formData.get("titel") ?? ""));
    if (!ok) throw new Error("Karte gehört nicht zu dieser Welt");
    revalidatePath(`/worlds/${worldSlug}/atlas3d`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Umbenennen fehlgeschlagen" };
  }
}

/** Löscht eine Karte samt Baum. Unwiderruflich — die Bestätigung sitzt in der UI. */
export async function loescheTerraKarteAction(formData: FormData): Promise<TerraSpeichernErgebnis> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const karteId = String(formData.get("karteId"));
  try {
    const terra = createTerraService(createPrismaClient());
    const ok = await terra.loesche(worldSlug, karteId);
    if (!ok) throw new Error("Karte gehört nicht zu dieser Welt");
    revalidatePath(`/worlds/${worldSlug}/atlas3d`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Löschen fehlgeschlagen" };
  }
}
