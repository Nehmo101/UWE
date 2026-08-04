/**
 * DM-Bereiche über Entity-Grenzen hinweg heil halten — das Gegenstück zu
 * `packages/doc-import/src/semantic/dm-balance.ts` (#82) für den
 * PDF-Kampagnen-Import.
 *
 * Der Pfad hier transportiert Marken sehr wohl: Der Chunker zerlegt den
 * PDF-Text stur nach Länge, und die KI übernimmt Quelltext wörtlich in die
 * `body`-Felder. Wer ein selbst exportiertes Kampagnen-PDF (oder ein Markdown-
 * als-PDF) mit `:::dm … :::` importiert, dessen Marken können an einer
 * Chunk-Grenze auseinandergerissen werden. Gemessen an dm-section.ts heißt
 * das: Die Seite mit der öffnenden Marke verschluckt fail-closed ihren Rest,
 * und **alle folgenden Seiten des Bereichs tragen gar keine Marke mehr** —
 * ausdrücklich als DM-Material gekennzeichneter Inhalt stünde offen im Wiki.
 *
 * Die Entities kommen in Dokumentreihenfolge (Chunk-Reihenfolge) an, also
 * gilt dieselbe Lösung wie in doc-import: einmal darüberlaufen und den offen
 * gebliebenen Bereich mittragen.
 */
import { DM_SECTION_CLOSE, DM_SECTION_OPEN, findDmSections } from "@uwe/auth/dm-section";

export interface DmBalanceableEntity {
  title: string;
  body: string;
}

export function balanceEntityDmSections<T extends DmBalanceableEntity>(
  entities: T[],
): { entities: T[]; balanced: number } {
  let openTitle: string | null = null;
  let balanced = 0;

  const out = entities.map((entity) => {
    let body = entity.body ?? "";
    let touched = false;

    if (openTitle !== null) {
      // Der Bereich lief aus dem vorigen Entity herein — hier neu aufmachen.
      body = `${DM_SECTION_OPEN} ${openTitle}\n${body}`;
      touched = true;
    }

    const sections = findDmSections(body);
    const last = sections[sections.length - 1];

    if (last?.unclosed) {
      // Läuft über das Entity-Ende hinaus — hier schließen, drüben weiterführen.
      body = `${body}\n${DM_SECTION_CLOSE}`;
      openTitle = last.title ?? entity.title;
      touched = true;
    } else {
      openTitle = null;
    }

    if (!touched) return entity;
    balanced += 1;
    return { ...entity, body };
  });

  return { entities: out, balanced };
}
