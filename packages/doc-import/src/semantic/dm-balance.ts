/**
 * DM-Bereiche über Seitengrenzen hinweg heil halten.
 *
 * **Das Problem.** Im Dokument-Modus zerlegt `restructureDocument` einen Band in
 * viele Seiten. Eine Marke im Quelltext weiß davon nichts: Wer ein
 * Kampagnenbuch mit
 *
 * ```
 * :::dm Spielleiter-Dossier
 * ## Kapitel 1
 * …
 * ## Kapitel 3
 * :::
 * ```
 *
 * importiert, bekommt die öffnende Marke auf die Wurzelseite und die
 * schließende auf Kapitel 3. Ergebnis, gemessen: Die Wurzelseite verschluckt
 * fail-closed ihren eigenen Rest, und **Kapitel 1 und 2 tragen gar keine Marke
 * mehr** — genau der Inhalt, den jemand ausdrücklich als DM-Bereich
 * gekennzeichnet hat, steht danach für jeden Spieler offen.
 *
 * Das ist die falsche Richtung. `dm-section.ts` ist mit Bedacht fail-closed
 * gebaut; ein Import, der aus einer Marke drei offene Seiten macht, hebelt das
 * aus.
 *
 * **Die Lösung.** Die Seiten stehen in Dokumentreihenfolge. Also läuft man
 * einmal darüber und trägt mit, ob man gerade in einem DM-Bereich steckt: Wer
 * in einem offenen Bereich auf einer Seite ankommt, bekommt die Marke dort neu
 * gesetzt; wer eine Seite mit offenem Bereich verlässt, bekommt sie geschlossen.
 * Jede Seite trägt danach ausgeglichene Marken, und der Bereich bleibt
 * inhaltlich genau der, den der Autor gemeint hat.
 *
 * Der Titel wandert mit, damit im Studio über jedem Teilstück derselbe
 * DM-Kasten steht wie über dem ersten.
 *
 * **Nicht angefasst** wird die abgelegte Originaldatei (`import/quelltext`):
 * Sie ist der unveränderte Beleg und trägt ihre Marken ohnehin ausgeglichen.
 */

import { findDmSections, DM_SECTION_CLOSE, DM_SECTION_OPEN } from "@uwe/auth/dm-section";

/** Nur, was dieses Modul braucht — der volle `PageDraft` interessiert hier nicht. */
export interface DmBalanceablePage {
  title: string;
  html: string;
  tags?: string[];
}

export interface DmBalanceResult<T extends DmBalanceablePage> {
  pages: T[];
  /** Wie viele Seiten eine Marke ergänzt bekommen haben. */
  balanced: number;
}

/** Die Beleg-Seite bleibt außen vor — sie ist der unveränderte Quelltext. */
function isSourcePage(page: DmBalanceablePage): boolean {
  return page.tags?.includes("import/quelltext") ?? false;
}

/**
 * Gleicht die DM-Marken einer Seitenfolge aus.
 *
 * Erwartet die Seiten in **Dokumentreihenfolge**; in einer anderen Reihenfolge
 * wäre „gerade offen" bedeutungslos.
 */
export function balanceDmSections<T extends DmBalanceablePage>(pages: T[]): DmBalanceResult<T> {
  let openTitle: string | null = null;
  let balanced = 0;

  const out = pages.map((page) => {
    if (isSourcePage(page)) return page;

    let html = page.html ?? "";
    let touched = false;

    if (openTitle !== null) {
      // Der Bereich lief von der vorigen Seite herein — hier neu aufmachen.
      html = `<p>${DM_SECTION_OPEN} ${openTitle}</p>\n${html}`;
      touched = true;
    }

    const sections = findDmSections(html);
    const last = sections[sections.length - 1];

    if (last?.unclosed) {
      // Läuft über das Seitenende hinaus — hier schließen, drüben weiterführen.
      html = `${html}\n<p>${DM_SECTION_CLOSE}</p>`;
      openTitle = last.title ?? page.title;
      touched = true;
    } else {
      openTitle = null;
    }

    if (!touched) return page;
    balanced += 1;
    return { ...page, html };
  });

  return { pages: out, balanced };
}
