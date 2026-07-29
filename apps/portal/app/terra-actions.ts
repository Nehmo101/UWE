"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { createTerraService } from "@uwe/database/terra";
import { canCreateTerraKarte } from "@uwe/auth";
import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

/**
 * Terra im Portal (J5) — der Schreibweg für Spieler.
 *
 * Bis zu dieser Runde gab es hier NICHTS. Der Portal-Rahmen war einseitig,
 * und die Begründung dafür stand an mehreren Stellen im Klartext: „im Portal
 * existiert keine Server Action zum Schreiben" — die Absicherung war das
 * fehlende Gegenüber. Diese Datei ist genau dieses Gegenüber, und sie muss
 * deshalb selbst tragen, was vorher die Abwesenheit getragen hat.
 *
 * Vier Prüfungen, jede Aktion, in dieser Reihenfolge:
 *
 *   1. `requirePortalActionAuth()`   — CSRF/Origin. Middleware allein genügt
 *                                      nicht, eine Server Action ist ein POST
 *                                      wie jeder andere.
 *   2. Anmeldung + Weltzugang        — `getAccessContextForWorld` liefert für
 *                                      eine fremde Welt `null`. Das ist die
 *                                      Stelle, an der „nur für die Welt, für
 *                                      die er freigeschaltet ist" hängt.
 *   3. `canCreateTerraKarte(ctx)`    — Welt-ZUORDNUNG, nicht nur Lesbarkeit.
 *                                      Ein Studio-Häkchen darf die Welt lesen
 *                                      (Vorschau), aber nicht in ihr bauen.
 *   4. Autor- und Zustandsgrenze     — im `where` des Schreibvorgangs, siehe
 *                                      `@uwe/database/terra`. Nicht hier,
 *                                      weil zwischen einer Prüfung hier und
 *                                      dem Schreiben dort die Abnahme des
 *                                      Spielleiters liegen könnte.
 *
 * Was NICHT geprüft wird, und zwar mit Absicht: der Inhalt der Karte. Der
 * Spieler baut, was er will — Größe, Form, Ebenen, Namen. Die einzige Grenze
 * ist die Nutzlast (siehe DATEN_MAX), und die ist eine Grenze der Leitung,
 * keine des Inhalts.
 *
 * DATENBANK: der geteilte Client (`prisma`), nie `createPrismaClient()` je
 * Aufruf — dieselbe Begründung wie in `apps/studio/app/terra-actions.ts`
 * (SQLite serialisiert Schreiber; Verbindungen je Anfrage erzeugen Sperr-
 * stürme und lecken).
 */

export interface TerraSpielerErgebnis {
  ok: boolean;
  /** Neue Zeilenversion nach dem Schreiben — geht über die Brücke zurück. */
  version?: number;
  /** true, wenn jemand anders inzwischen gespeichert hat. */
  konflikt?: boolean;
  error?: string;
}

/** Wie im Studio: über der Payload-Grenze der Server Actions wäre die Meldung
 *  sonst ein 413 ohne Erklärung. */
const DATEN_MAX = 12 * 1024 * 1024;

/**
 * Die gemeinsame Eintrittsprüfung. Wirft, statt `null` zurückzugeben: eine
 * Server Action, die still nichts tut, ist die schlechtere Auskunft.
 */
async function pruefeSpieler(worldSlug: string) {
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const world = await prisma.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
  if (!world) {
    throw new Error("Welt nicht gefunden");
  }
  assertPortalCanReadWorld(ctx, world.id);

  if (!canCreateTerraKarte(ctx)) {
    throw new Error("Keine Berechtigung, in dieser Welt Karten zu bauen");
  }

  // Der Charaktername dieser Welt, sonst der Anzeigename — derselbe Griff wie
  // bei den Spielerfragen. Der Spielleiter soll in der Abnahmeliste den Namen
  // lesen, unter dem die Person am Tisch sitzt.
  const autorName = ctx.worldMembership?.characterName?.trim() || user.displayName || "Spieler";
  return { user, ctx, autorName };
}

function pfade(worldSlug: string, karteId?: string): void {
  revalidatePath(`/auth/worlds/${worldSlug}/karten`);
  if (karteId) revalidatePath(`/auth/worlds/${worldSlug}/karten/${karteId}`);
}

/**
 * Legt einen leeren Entwurf an und führt gleich in den Editor.
 *
 * `redirect()` steht ausserhalb des `try`: Next.js signalisiert die
 * Weiterleitung über eine geworfene Ausnahme, ein umschliessendes `catch`
 * würde sie schlucken und die Seite still stehen lassen.
 */
export async function erstelleSpielerKarteAction(formData: FormData): Promise<void> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const { user, autorName } = await pruefeSpieler(worldSlug);

  const terra = createTerraService(prisma);
  const karte = await terra.erstelleSpielerEntwurf(worldSlug, {
    titel: String(formData.get("titel") ?? ""),
    autorUserId: user.id,
    autorName,
  });

  pfade(worldSlug);
  redirect(`/auth/worlds/${worldSlug}/karten/${karte.id}`);
}

/**
 * Speichert den ganzen Kartenbaum eines eigenen Entwurfs.
 *
 * Kein `revalidatePath` — der Editor besitzt die laufende Szene, ein Remount
 * würde die Kamera zurücksetzen (gleiche Begründung wie im Studio).
 */
export async function speichereSpielerKarteAction(formData: FormData): Promise<TerraSpielerErgebnis> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const karteId = String(formData.get("karteId") ?? "");

  try {
    const { user } = await pruefeSpieler(worldSlug);

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
    const ergebnis = await terra.speichereEntwurf(worldSlug, karteId, {
      daten,
      erwarteteVersion,
      titel: titelRoh === null ? undefined : String(titelRoh),
      autorUserId: user.id,
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
    // „unbekannt" deckt hier drei Fälle ab, die der Spieler gleich behandeln
    // soll: fremde Welt, fremde Karte, oder der Spielleiter hat sie in der
    // Zwischenzeit abgenommen. In allen dreien ist Weiterschreiben falsch.
    return {
      ok: false,
      error: "Dieser Entwurf lässt sich nicht mehr speichern — er wurde eingereicht, abgenommen oder entfernt.",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/** Benennt den eigenen Entwurf um, ohne den Baum anzufassen. */
export async function benenneSpielerKarteAction(formData: FormData): Promise<void> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const karteId = String(formData.get("karteId") ?? "");
  const { user } = await pruefeSpieler(worldSlug);

  const terra = createTerraService(prisma);
  const ok = await terra.benenneEntwurf(worldSlug, karteId, user.id, String(formData.get("titel") ?? ""));
  if (!ok) throw new Error("Dieser Entwurf lässt sich nicht mehr umbenennen");

  pfade(worldSlug, karteId);
}

/** Reicht den eigenen Entwurf beim Spielleiter zur Abnahme ein. */
export async function reicheSpielerKarteEinAction(formData: FormData): Promise<void> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const karteId = String(formData.get("karteId") ?? "");
  const { user } = await pruefeSpieler(worldSlug);

  const terra = createTerraService(prisma);
  const ok = await terra.reicheEin(worldSlug, karteId, user.id);
  if (!ok) throw new Error("Dieser Entwurf lässt sich nicht einreichen");

  pfade(worldSlug, karteId);
}

/** Zieht die Einreichung zurück — der Entwurf ist danach wieder bearbeitbar. */
export async function ziehSpielerKarteZurueckAction(formData: FormData): Promise<void> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const karteId = String(formData.get("karteId") ?? "");
  const { user } = await pruefeSpieler(worldSlug);

  const terra = createTerraService(prisma);
  const ok = await terra.ziehZurueck(worldSlug, karteId, user.id);
  if (!ok) throw new Error("Diese Einreichung lässt sich nicht zurückziehen");

  pfade(worldSlug, karteId);
}

/**
 * Löscht die eigene, noch nicht abgenommene Karte.
 *
 * Nach der Abnahme geht das nicht mehr: die Karte gehört dann der Welt. Der
 * Service setzt diese Grenze im `where`, nicht die Oberfläche.
 */
export async function loescheSpielerKarteAction(formData: FormData): Promise<void> {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const karteId = String(formData.get("karteId") ?? "");
  const { user } = await pruefeSpieler(worldSlug);

  const terra = createTerraService(prisma);
  const ok = await terra.loescheEigenenEntwurf(worldSlug, karteId, user.id);
  if (!ok) throw new Error("Diese Karte lässt sich nicht mehr löschen");

  pfade(worldSlug, karteId);
  redirect(`/auth/worlds/${worldSlug}/karten`);
}
