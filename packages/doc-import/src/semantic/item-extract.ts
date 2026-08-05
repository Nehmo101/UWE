/**
 * Aus einer importierten Gegenstandsseite werden Werkbank-Daten.
 *
 * Die Magic-Item-Werkbank (`StructuredItem`) hatte bis hierher keinen
 * Import-Pfad: Ein Kampagnenbuch brachte seine Gegenstände als Wiki-Seiten mit
 * vollem Text mit, die Werkbank blieb aber leer, weil sie nur das Studio-Formular
 * befüllt. Dieses Modul schließt die Lücke und liest aus dem fertigen HTML einer
 * Seite heraus, was die Werkbank braucht.
 *
 * **Die eine Regel, an der alles hängt:** `visibleDescription` und `properties`
 * landen im Spieler-Handout (`toPlayerHandout`), `dmSecret` und `curse` nicht.
 * Deshalb darf nichts aus einem `:::dm`-Bereich oder einem Spielleitungs-
 * Abschnitt jemals in den ersten beiden Feldern landen. Der Extraktor trennt
 * darum zuerst und liest erst danach.
 *
 * Bewusst zurückhaltend: Was nicht dasteht, wird nicht erfunden. Nennt ein
 * Dokument keine Seltenheit, bleibt das Feld leer — eine geratene Einstufung
 * wäre im 5e-Export eine Falschaussage, und ein leeres Feld ist im Formular in
 * Sekunden gefüllt.
 */

import type { MagicItemData } from "@uwe/database/magic-item";

/** Seltenheiten, wie sie in deutschen Vorlagen am Zeilenanfang stehen. */
const RARITY_RULES: Array<[RegExp, string]> = [
  [/^\s*artefakt\b/i, "artifact"],
  [/^\s*legend(är|aer)\b/i, "legendary"],
  [/^\s*sehr\s+selten\b/i, "very_rare"],
  [/^\s*ungew(ö|oe)hnlich\b/i, "uncommon"],
  [/^\s*gew(ö|oe)hnlich\b/i, "common"],
  [/^\s*selten\b/i, "rare"],
];

/**
 * Typbezeichnungen, auf kanonische Labels normalisiert. Die Wortgrenzen sind
 * nicht kosmetisch: ohne sie wird aus „Sieben Schiffsnamen" ein Fahrzeug.
 * Reihenfolge = spezifisch vor generisch, damit „Gegenstand · Tattoo" als
 * Tattoo ankommt.
 */
const TYPE_RULES: Array<[RegExp, string]> = [
  [/\bplotgegenstand\w*/i, "Plotgegenstand"],
  [/\bhandouts?\b/i, "Handout"],
  [/\bdokument\w*/i, "Dokument"],
  [/\bkristall\w*/i, "Kristall"],
  [/\btattoos?\b/i, "Tattoo"],
  [/\bhausregel\w*/i, "Hausregel"],
  [/\bbelohnung\w*/i, "Belohnung"],
  [/\btr(a|ä)nke?\b/i, "Trank"],
  [/\bwaffen?\b/i, "Waffe"],
  [/\br(ü|ue)stung\w*/i, "Rüstung"],
  [/schiff\b|\bfahrzeug\w*|\bzug\b/i, "Fahrzeug"],
  [/\bwerkzeug\w*/i, "Werkzeug"],
  [/\bgegenst(a|ä)nd\w*/i, "Gegenstand"],
];

/** Abschnitte, die Spielleitungsmaterial enthalten — auch ohne `:::dm`. */
const DM_HEADING = /^(am tisch|f(ü|ue)r die spielleitung|dm-notizen?|spielleitung)$/i;

/** Abschnitte, deren Aufzählungen mechanische Eigenschaften sind. */
const PROPERTY_HEADING =
  /^(eigenschaften|werte|effekt|wirkung|was es kann|die techniken|die klauseln)$/i;

/** Abschnitte, die beschreibenden Vorspann liefern. */
const OVERVIEW_HEADING = /^(auf einen blick|kontext|herkunft|fundort)$/i;

/** Zweispaltige Tabellenzeilen mit diesen Labels sind Mechanik, nicht Prosa. */
const MECHANIC_LABEL =
  /^(wirkung|effekt|werte|eigenschaft\w*|aufladung\w*|ladungen|reichweite|dauer|rettungswurf|dc|schaden|bonus|nutzung\w*)$/i;

const ATTUNEMENT = /einstimmung|attunement|eingestimmt/i;

/**
 * Ein Fluch nur dann, wenn er dem Gegenstand zugeschrieben wird. „Läuten
 * beendet einen magischen Zustand oder Fluch." ist eine Eigenschaft — deshalb
 * zählt weder das Wort allein noch ein Satzende darauf. Es braucht ein Label
 * („Fluch: …") oder eine Formulierung, die den Fluch dem Gegenstand zuschreibt.
 */
const CURSE_HEADING = /^flu(ch|ch\b.*)$/i;
const CURSE_PHRASE = /(^|\s)fluch\s*:|ist verflucht|verfluchter?\s|tr(ä|ae)gt einen fluch/i;

const MAX_DESCRIPTION = 1200;
const MAX_DM_SECRET = 2000;
const MAX_CURSE = 400;
const MAX_PROPERTY = 300;
const MAX_PROPERTIES = 12;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&amp;/g, "&");
}

/**
 * HTML zu Klartext machen — und zwar so, dass am Ende nachweislich kein
 * Markup mehr entstehen kann.
 *
 * Ein einzelner `replace(/<[^>]+>/g, "")` genügt dafür nicht: `<scr<script>ipt>`
 * überlebt einen Durchgang, und ein anschließendes Entity-Decoding kann aus
 * `&lt;script&gt;` wieder echte spitze Klammern machen. Deshalb wird erst in
 * Schleife entfernt, bis sich nichts mehr ändert, dann decodiert, und zuletzt
 * bleiben keine spitzen Klammern übrig. Die Felder landen in Exporten und im
 * Spieler-Handout — dort darf aus einem importierten Dokument nichts werden,
 * was sich als Element lesen lässt.
 */
function stripMarkup(html: string): string {
  let current = html;
  let previous: string;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, "");
  } while (current !== previous);

  return decodeEntities(current).replace(/[<>]/g, "");
}

/** HTML → Klartext, Zeilenstruktur erhalten, Tabellenzellen als „Label: Wert". */
function toText(html: string): string {
  return stripMarkup(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|li|tr|h[1-6]|blockquote)>/gi, "\n")
      .replace(/<\/td>\s*<td[^>]*>/gi, ": "),
  )
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Schneidet `:::dm … :::`-Bereiche heraus. Rest = spielersichtbar. */
export function splitDmRegions(html: string): { visible: string; dm: string } {
  const dmParts: string[] = [];
  const visible = html.replace(
    /<p>\s*:::dm\b(.*?)<\/p>(.*?)(?:<p>\s*:::\s*<\/p>|$)/gs,
    (_match, label: string, body: string) => {
      const labelText = toText(label);
      const bodyText = toText(body);
      // „:::dm Am Tisch" gefolgt von <h2>Am Tisch</h2> — Titel nicht doppeln.
      const duplicated =
        labelText.length > 0 &&
        bodyText.split("\n")[0]?.toLowerCase() === labelText.toLowerCase();
      dmParts.push((duplicated ? bodyText : `${labelText}\n${bodyText}`).trim());
      return "";
    },
  );
  return { visible, dm: dmParts.join("\n\n").trim() };
}

interface Section {
  heading: string;
  html: string;
}

/** Zerlegt an <h2>/<h3>; alles vor der ersten Überschrift bekommt den Titel "". */
function splitSections(html: string): Section[] {
  const sections: Section[] = [];
  const pattern = /<h[23][^>]*>(.*?)<\/h[23]>/gs;
  let cursor = 0;
  let heading = "";
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    sections.push({ heading, html: html.slice(cursor, match.index) });
    heading = stripMarkup(match[1]).trim();
    cursor = pattern.lastIndex;
  }
  sections.push({ heading, html: html.slice(cursor) });
  return sections;
}

function listItems(html: string): string[] {
  return [...html.matchAll(/<li>(.*?)<\/li>/gs)]
    .map((match) => toText(match[1]).replace(/\n/g, " ").trim())
    .filter((entry) => entry.length > 2);
}

function mechanicRows(html: string): string[] {
  return [...html.matchAll(/<tr>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gs)]
    .map(
      (match) => [toText(match[1]).trim(), toText(match[2]).replace(/\n/g, " ").trim()] as const,
    )
    .filter(([label, value]) => MECHANIC_LABEL.test(label) && value.length > 2)
    .map(([label, value]) => `${label}: ${value}`);
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const breakAt = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
  return `${(breakAt > max * 0.6 ? cut.slice(0, breakAt) : cut).trim()} …`;
}

/**
 * Liest Werkbank-Daten aus dem HTML einer Gegenstandsseite.
 *
 * @param title Seitentitel — letzte Quelle für den Typ („Tattoo des …").
 * @param html  Fertiges Seiten-HTML, wie es auch im ContentBlock landet.
 * @returns `null`, wenn nichts Belastbares herauskommt (dann kein Datensatz).
 */
export function extractMagicItemData(title: string, html: string): MagicItemData | null {
  if (!html.trim()) return null;

  const { visible, dm } = splitDmRegions(html);
  const sections = splitSections(visible);

  const headMatch = visible.match(/^\s*<p>\s*<(?:strong|em)>(.*?)<\/(?:strong|em)>\s*<\/p>/s);
  const headText = headMatch ? toText(headMatch[1]) : "";
  const segments = headText
    .split("·")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let rarity: string | undefined;
  const remaining: string[] = [];
  for (const segment of segments) {
    const hit = RARITY_RULES.find(([pattern]) => pattern.test(segment));
    if (hit && !rarity) rarity = hit[1];
    else remaining.push(segment);
  }

  let itemType = "Gegenstand";
  search: for (const [pattern, label] of TYPE_RULES) {
    for (const candidate of [...remaining, title]) {
      if (pattern.test(candidate)) {
        itemType = label;
        break search;
      }
    }
  }

  const introHtml = (sections[0]?.html ?? "").replace(
    /^\s*<p>\s*<(?:strong|em)>.*?<\/(?:strong|em)>\s*<\/p>/s,
    "",
  );
  const overview = sections.find((section) => OVERVIEW_HEADING.test(section.heading));
  const visibleDescription =
    clamp(
      [headText, toText(introHtml), overview ? toText(overview.html) : ""]
        .filter(Boolean)
        .join("\n")
        .trim(),
      MAX_DESCRIPTION,
    ) || undefined;

  const usable = sections.filter((section) => !DM_HEADING.test(section.heading));
  let properties = usable
    .filter((section) => PROPERTY_HEADING.test(section.heading))
    .flatMap((section) => listItems(section.html));

  const fromTables = usable
    .filter((section) => !/verbindungen|chronik/i.test(section.heading))
    .flatMap((section) => mechanicRows(section.html));
  properties = [...properties, ...fromTables.filter((entry) => !properties.includes(entry))];

  if (properties.length === 0) {
    const fallback = usable.find(
      (section) =>
        !/verbindungen|erw(ä|ae)hnungen|chronik|fundkontext/i.test(section.heading) &&
        listItems(section.html).length > 0,
    );
    properties = fallback ? listItems(fallback.html) : [];
  }
  properties = properties.map((entry) => clamp(entry, MAX_PROPERTY)).slice(0, MAX_PROPERTIES);

  const curseSection = sections.find((section) => CURSE_HEADING.test(section.heading));
  const curseLine = `${toText(visible)}\n${dm}`
    .split("\n")
    .find((line) => CURSE_PHRASE.test(line));
  const curseText = curseSection ? toText(curseSection.html) : curseLine;

  const dmSections = sections
    .filter((section) => DM_HEADING.test(section.heading))
    .map((section) => toText(section.html));
  const dmSecret = clamp([dm, ...dmSections].filter(Boolean).join("\n\n").trim(), MAX_DM_SECRET);

  const data: MagicItemData = {
    itemType,
    ...(rarity ? { rarity } : {}),
    requiresAttunement: ATTUNEMENT.test(visible),
    ...(visibleDescription ? { visibleDescription } : {}),
    ...(properties.length ? { properties } : {}),
    ...(dmSecret ? { dmSecret } : {}),
    ...(curseText ? { curse: clamp(curseText, MAX_CURSE) } : {}),
  };

  // Ohne Beschreibung und ohne Eigenschaften wäre der Datensatz eine leere
  // Hülle — dann lieber gar keiner, damit die Werkbank ehrlich „ungefüllt" zeigt.
  if (!data.visibleDescription && !data.properties?.length) return null;
  return data;
}
