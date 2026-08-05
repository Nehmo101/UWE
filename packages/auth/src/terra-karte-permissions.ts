import type { AccessContext } from "./types";

/**
 * Terra-Karten aus dem Portal (J5) — wer darf im Portal eine Karte bauen und
 * an welcher.
 *
 * Die Regel ist die des Häkchenmodells und sonst nichts: **die Welt-Zuordnung
 * entscheidet**. Wer der Welt zugeordnet ist, baut darin Karten — ohne
 * Einschränkung im Werkzeug, ohne Kontingent, ohne Rollenstufe. Was gebaut
 * wird, ist bis zur Abnahme durch den Spielleiter ein Entwurf; das ist eine
 * Frage des Zustands, nicht des Rechts, und steht deshalb im Service.
 *
 * Zwei Fälle fallen bewusst heraus:
 *
 *   VORSCHAU. `previewAsUserId` ist ein Spielleiter, der sich das Portal
 *   ansieht. Schreiben darf er dort nicht — was er anlegte, trüge den Namen
 *   eines Spielers, der nie etwas gebaut hat. Gleiche Entscheidung wie bei
 *   den Spielernotizen (`canCreatePlayerNote`).
 *
 *   HÄKCHEN OHNE ZUORDNUNG. `canReadWorld` lässt das Studio-Häkchen immer
 *   durch, damit die Vorschau funktioniert — Lesen ist damit weiter
 *   gestattet, Schreiben nicht. Deshalb steht hier `worldMembership !== null`
 *   und nicht bloß `user !== null`: sonst könnte jemand mit Studio-Häkchen im
 *   Portal in einer Welt Karten anlegen, der er nie zugeordnet wurde.
 */

/** Was von einer Karte gebraucht wird, um über sie zu entscheiden. */
export interface TerraKarteAccessInfo {
  /** `null` = im Studio entstanden; ein Spieler fasst sie nie an. */
  autorUserId: string | null;
  status: "entwurf" | "eingereicht" | "freigegeben";
  /**
   * Sperre des Spielleiters. Gesperrt heißt: im Portal nur noch ansehen —
   * auch für den Autor, auch am Entwurf. Optional, damit ältere Aufrufer
   * ohne das Feld weiter funktionieren; fehlend zählt als nicht gesperrt.
   */
  gesperrt?: boolean;
}

/** Wer der Welt zugeordnet ist, darf darin Karten anlegen. */
export function canCreateTerraKarte(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user !== null && ctx.worldMembership !== null;
}

/**
 * Ein Spieler sieht im Portal alles Abgenommene seiner Welt — und zusätzlich
 * seine eigenen, noch nicht abgenommenen Karten. Fremde Entwürfe nicht: was
 * im Portal steht, ist geprüfter Weltinhalt.
 */
export function canViewTerraKarte(ctx: AccessContext, karte: TerraKarteAccessInfo): boolean {
  if (karte.status === "freigegeben") {
    return true;
  }
  return karte.autorUserId !== null && ctx.user?.id === karte.autorUserId;
}

/**
 * Schreiben im Portal: nur am eigenen Entwurf. Eingereichtes liegt beim
 * Spielleiter, Abgenommenes gehört der Welt.
 *
 * Diese Funktion ist die Auskunft für die Oberfläche — die verbindliche
 * Prüfung steht im `where` des Schreibvorgangs (`speichereEntwurf`), damit
 * zwischen Frage und Antwort keine Abnahme dazwischenkommen kann.
 */
export function canEditTerraKarte(ctx: AccessContext, karte: TerraKarteAccessInfo): boolean {
  if (!canCreateTerraKarte(ctx) || karte.gesperrt === true) {
    return false;
  }
  return karte.status === "entwurf" && karte.autorUserId !== null && ctx.user?.id === karte.autorUserId;
}

/**
 * Einreichen und Zurückziehen — dieselbe Autorgrenze, der andere Zustand.
 */
export function canSubmitTerraKarte(ctx: AccessContext, karte: TerraKarteAccessInfo): boolean {
  return canEditTerraKarte(ctx, karte);
}

export function canWithdrawTerraKarte(ctx: AccessContext, karte: TerraKarteAccessInfo): boolean {
  if (!canCreateTerraKarte(ctx) || karte.gesperrt === true) {
    return false;
  }
  return (
    karte.status === "eingereicht" && karte.autorUserId !== null && ctx.user?.id === karte.autorUserId
  );
}

/** Löschen darf der Autor, solange die Karte nicht abgenommen ist. */
export function canDeleteTerraKarte(ctx: AccessContext, karte: TerraKarteAccessInfo): boolean {
  if (!canCreateTerraKarte(ctx) || karte.gesperrt === true) {
    return false;
  }
  return karte.status !== "freigegeben" && karte.autorUserId !== null && ctx.user?.id === karte.autorUserId;
}
