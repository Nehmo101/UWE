import { stripDmSections } from "./dm-section";
import type {
  AccessContext,
  AuthUser,
  PreviewOptions,
  WorldMembership,
} from "./types";

/**
 * Studio is the DM workspace, so the Studio checkbox is what makes someone a
 * DM. Preview mode deliberately drops it: that is the point of previewing.
 */
export function isDm(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.access.studio === true;
}

export function isOwner(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.isOwner === true;
}

export function canEditContent(ctx: AccessContext): boolean {
  return isDm(ctx);
}

export function buildAccessContext(input: {
  user: AuthUser | null;
  worldMembership: WorldMembership | null;
  preview?: PreviewOptions;
}): AccessContext {
  return {
    user: input.user,
    worldMembership: input.worldMembership,
    previewAsUserId: input.preview?.previewAsUserId ?? null,
  };
}

/**
 * The single content rule inside a world: whoever is assigned to the world
 * sees everything in it.
 *
 * Per-item visibility is gone (Notiz Lasse, 2026-07-26) — there is no
 * `dm_only`, no `player_visible`, no draft state and no per-page grant left to
 * differentiate. What remains is the assignment itself, plus the Studio
 * checkbox, which reaches every world by design.
 */
export function canViewWorldContent(ctx: AccessContext): boolean {
  if (ctx.worldMembership !== null) {
    return true;
  }
  return ctx.user?.access.studio === true;
}

/**
 * Der DM-Bereich mitten im Wikitext (`:::dm … :::`, siehe `dm-section.ts`).
 *
 * Die eine Ausnahme von „wer der Welt zugeordnet ist, sieht darin alles": diese
 * Zeilen liest nur, wer das Studio-Häkchen trägt. Der Owner geht mit durch —
 * er richtet die Häkchen ein, ein Owner ohne Zugriff auf seine eigenen Notizen
 * wäre eine Falle ohne Nutzen.
 *
 * Die Welt-Zuordnung ersetzt das Häkchen hier NICHT: Studio ist die DM-App, und
 * DM ist, wer dort hinein darf. Die Vorschau als Spieler fällt bewusst heraus —
 * genau dafür ist sie da.
 */
export function canReadDmSections(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.access.studio === true || ctx.user?.isOwner === true;
}

/**
 * Schneidet die DM-Bereiche aus einem Textfeld, wenn der Betrachter sie nicht
 * lesen darf. `null`/`undefined` bleiben, was sie waren.
 */
export function redactDmSectionsForViewer<T extends string | null | undefined>(
  ctx: AccessContext,
  text: T,
): T {
  if (typeof text !== "string" || canReadDmSections(ctx)) {
    return text;
  }
  return stripDmSections(text) as T;
}

/**
 * Darf dieser Betrachter auch Seiten sehen, die nicht fürs Portal freigegeben
 * sind?
 *
 * Dieselbe Linie wie beim DM-Bereich: das Studio-Häkchen, plus der Owner. Die
 * Welt-Zuordnung reicht nicht — sie sagt, *welche* Welt jemand sieht, nicht
 * welche Seiten daraus. Und die Vorschau als Spieler fällt heraus, sonst
 * zeigte sie nicht, was sie zeigen soll.
 */
export function canSeeUnreleasedPages(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user?.access.studio === true || ctx.user?.isOwner === true;
}

/**
 * Trägt diese Seite den Portal-Haken?
 *
 * **Fail-closed, und zwar bewusst gegen den bequemen Fall.** Fehlt das Feld —
 * weil eine Abfrage es nicht mitgeladen hat —, gilt die Seite als nicht
 * freigegeben. Der Fehler ist dann laut (eine Liste bleibt leer) statt still
 * (ein Kampagnenbuch steht im Spieler-Wiki).
 */
function isPortalReleased(page: unknown): boolean {
  if (!page || typeof page !== "object") return false;
  return (page as { portalReleased?: unknown }).portalReleased === true;
}

/**
 * Das Tor für ganze Seiten.
 *
 * Zwei Stufen, und sie beantworten verschiedene Fragen: Die Welt-Zuordnung
 * entscheidet, ob es überhaupt Seiten gibt; der Portal-Haken entscheidet je
 * Seite, ob sie im Spieler-Wiki auftaucht.
 *
 * Der Unterschied zum `:::dm`-Bereich ist der Umfang. Der schneidet Zeilen aus
 * einer Seite, die es weiterhin gibt — mit Titel, in der Suche, im Seitenbaum
 * und im Inhaltsverzeichnis. Für „Der Tag der Asche (die volle Wahrheit für die
 * SL)" genügt das nicht: Da verrät die Überschrift, was der Text verschweigt.
 * Hier fällt die Seite als Ganzes weg.
 */
export function filterPagesForViewer<T>(ctx: AccessContext, pages: T[]): T[] {
  if (!canViewWorldContent(ctx)) {
    return [];
  }
  if (canSeeUnreleasedPages(ctx)) {
    return pages;
  }
  return pages.filter(isPortalReleased);
}

/**
 * Das Tor für Inhaltsblöcke. Es entscheidet zweierlei: ob es überhaupt Blöcke
 * gibt (Welt-Zuordnung) und ob deren DM-Bereiche darin stehen bleiben
 * (Studio-Häkchen).
 *
 * Der zweite Schnitt passiert hier — an der Stelle, die jeder Lesepfad ohnehin
 * passiert — und nicht erst beim Rendern. Wer die Blöcke aus einem anderen
 * Grund anfasst (Suche, Graph, Export), bekommt sie dadurch schon geschnitten
 * und muss nichts davon wissen.
 */
export function filterBlocksForViewer<T>(ctx: AccessContext, blocks: T[]): T[] {
  if (!canViewWorldContent(ctx)) {
    return [];
  }
  if (canReadDmSections(ctx)) {
    return blocks;
  }

  // Kopiert wird erst, wenn wirklich etwas herausfällt — Block wie Liste. Der
  // Normalfall ist, dass keine Marke im Text steht; dann muss dieser Pfad
  // nichts allozieren und der Aufrufer behält seine Identitäten (der
  // Suchindex-Cache prüft genau darauf).
  let redacted: T[] | null = null;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = redactBlockContent(blocks[index]);
    if (block === blocks[index]) {
      redacted?.push(block);
      continue;
    }
    redacted ??= blocks.slice(0, index);
    redacted.push(block);
  }

  return redacted ?? blocks;
}

/** Gibt denselben Block zurück, wenn nichts herausfällt. */
function redactBlockContent<T>(block: T): T {
  if (!block || typeof block !== "object") {
    return block;
  }
  const content = (block as { content?: unknown }).content;
  if (typeof content !== "string") {
    return block;
  }
  // Ein Durchgang, nicht zwei: `stripDmSections` gibt bei markenlosem Text
  // denselben String zurück, nicht nur einen gleichen.
  const stripped = stripDmSections(content);
  return stripped === content ? block : { ...block, content: stripped };
}

export function filterAssetsForViewer<T>(ctx: AccessContext, assets: T[]): T[] {
  return canViewWorldContent(ctx) ? assets : [];
}

/** Only a Studio user can look at their world through a player's eyes. */
export function canPreviewAsPlayer(ctx: AccessContext): boolean {
  return !ctx.previewAsUserId && ctx.user?.access.studio === true;
}

/**
 * Ein synthetischer Spieler-Kontext für eine Welt: zugeordnet, aber ohne
 * Studio-Häkchen und ohne Owner-Rechte. `filterPagesForViewer` lässt damit nur
 * freigegebene Seiten durch, `redactDmSectionsForViewer` schneidet `:::dm`.
 *
 * Für die Wege, auf denen es keine echte Session gibt, deren Sicht aber die
 * eines Spielers sein MUSS: der statische Export und die
 * Spielervorschau-Parameter der Studio-API (MCP `portal_player_view_*`). Es
 * zählt nicht, WER fragt — sondern was die Antwort zeigen darf.
 */
export function buildPlayerViewContext(worldId: string): AccessContext {
  return buildAccessContext({
    user: null,
    worldMembership: {
      userId: "player-view",
      worldId,
      characterName: null,
    },
  });
}

/** The security audit log is a Studio concern. */
export function canViewAuditLog(ctx: AccessContext): boolean {
  return isDm(ctx);
}
