/**
 * Wie ein Abschnitt heißt — die Titelaufbereitung.
 *
 * Bewusst getrennt von der Rollenerkennung nebenan: Das eine beantwortet
 * „wovon handelt dieser Abschnitt", das andere „wie soll die Seite heißen".
 * Beides in einer Datei verleitet dazu, das eine vom anderen abhängig zu
 * machen — und genau das darf nicht sein. Eingeordnet wird an der
 * **Rohüberschrift**: `(Begegnung, vermeidbar)` ist für die Rolle ein Hinweis
 * und für den Titel Rauschen.
 */

/**
 * Gliederungsnummer am Anfang einer Überschrift.
 *
 * `C.1.3 Die Bannläufer` → `C.1.3` + `Die Bannläufer`. Das Dokument verweist auf
 * sich selbst über diese Nummern („siehe C.4.3", „F.2"), deshalb wird die Nummer
 * nicht weggeworfen, sondern zum Alias der Seite.
 *
 * Ohne Regex-Rückverfolgung: ein fester Präfix, danach ein Trenner, danach muss
 * echter Text stehen.
 */
const ENUMERATOR = /^([A-Za-zÄÖÜäöü]{0,2}\.?\s?\d+(?:\.\d+){0,3})[.):\s]\s*(?=\S)/;

/** „TEIL C — DER TURM", „Kapitel 2 – Die Reise", „Anhang B: Tabellen". */
const PART_PREFIX =
  /^(teil|kapitel|abschnitt|anhang|appendix|part|chapter|akt|buch)\s+([a-z0-9]{1,3})\b\s*[—–\-:.]?\s*/i;

/**
 * Zerlegt eine Überschrift in Nummer und Klartext.
 *
 * `TEIL D — DAS DACH` → `{ label: "TEIL D", text: "DAS DACH" }`. Der Klartext
 * wird der Seitentitel, das Etikett wird Alias. Bleibt nach dem Abschneiden
 * nichts Brauchbares übrig, bleibt die Überschrift, wie sie war — lieber ein
 * sperriger Titel als ein leerer.
 */
export function splitHeadingLabel(title: string): { label: string | null; text: string } {
  const trimmed = title.trim();

  const part = PART_PREFIX.exec(trimmed);
  if (part) {
    const rest = trimmed.slice(part[0].length).trim();
    if (rest.length >= 3) {
      return { label: `${part[1]} ${part[2]}`.trim(), text: rest };
    }
    return { label: null, text: trimmed };
  }

  const numbered = ENUMERATOR.exec(trimmed);
  if (numbered) {
    const rest = trimmed.slice(numbered[0].length).trim();
    if (rest.length >= 3) {
      return { label: numbered[1].replace(/\s+/g, ""), text: rest };
    }
  }

  return { label: null, text: trimmed };
}

/** Erkennt einen reinen Gliederungsteil („TEIL A — …", „Anhang B"). */
export function isPartHeading(title: string): boolean {
  return PART_PREFIX.test(title.trim());
}

/**
 * Redaktionelle Klammer am Ende einer Überschrift.
 *
 * `Die Bannläufer (Begegnung, vermeidbar)` sagt der Spielleitung, was sie
 * erwartet — als Seitentitel ist es Rauschen, denn der Seitentyp sagt dasselbe.
 * `Die Wachstube (Ost)` dagegen ist Ortsangabe und bleibt: Nur Klammern mit
 * einem der Redaktionswörter fallen weg.
 */
const TRAILING_PAREN = /\s*\(([^()]{0,80})\)\s*$/;
const EDITORIAL_WORDS =
  /(optional|empfohlen|vermeidbar|\bmodul\b|begegnung|r(ä|ae)tsel|\bfalle\b|\buhr\s*[−+\-]|variante|abh(ä|ae)ngig|siehe\s|nur\s+wenn)/i;

/**
 * Überschriften, die komplett in Großbuchstaben stehen, zurückholen.
 *
 * `DER MAGISTER-TURM VON VALIDORI` ist eine Setzerentscheidung im Dokument, kein
 * Name. Als Seitentitel im Wiki schreit sie. Angefasst wird nur, was **ganz**
 * groß geschrieben ist — gemischte Schreibweise ist immer eine Absicht.
 */
const PARTICLES = new Set([
  "von", "van", "der", "die", "das", "dem", "den", "des", "und", "oder", "im", "in", "am", "an",
  "auf", "aus", "bei", "für", "mit", "nach", "über", "um", "vor", "zu", "zur", "zum", "als", "wie",
  "gegen", "ohne", "durch", "unter", "hinter", "neben", "zwischen", "ein", "eine", "einer",
]);

const ROMAN = /^[IVXLCDM]+$/;

function deshout(title: string): string {
  return title
    .split(/(\s+)/)
    .map((token, index) => {
      if (!/\p{L}/u.test(token)) return token;
      if (ROMAN.test(token) && token.length <= 4) return token;

      const lower = token.toLocaleLowerCase("de");
      if (index > 0 && PARTICLES.has(lower)) return lower;

      // Bindestrich-Komposita bekommen auf beiden Seiten einen Großbuchstaben:
      // `MAGISTER-TURM` → `Magister-Turm`.
      return lower.replace(/(^|[-–—/])(\p{L})/gu, (_, sep: string, char: string) =>
        `${sep}${char.toLocaleUpperCase("de")}`,
      );
    })
    .join("");
}

/** Macht aus einer Überschrift einen Seitentitel. */
export function tidyHeadingText(title: string): string {
  let text = title.trim();

  const paren = TRAILING_PAREN.exec(text);
  if (paren && EDITORIAL_WORDS.test(paren[1])) {
    const stripped = text.slice(0, paren.index).trim();
    if (stripped.length >= 3) text = stripped;
  }

  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 2 && text === text.toLocaleUpperCase("de")) {
    text = deshout(text);
  }

  return text.replace(/\s+/g, " ").replace(/[\s—–\-:,;]+$/, "").trim() || title.trim();
}
