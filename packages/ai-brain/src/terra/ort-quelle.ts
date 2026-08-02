/**
 * Ort-Wikis als Ausgangspunkt der Terra-Vorgenerierung.
 *
 * „Karte beschreiben" (J4) kannte bis hierher genau eine Quelle: ein leeres
 * Textfeld. Der Spielleiter tippt eine Landschaft hinein, das Modell macht
 * Generator-Parameter daraus. Das Wiki der Welt stand daneben und wurde
 * ignoriert — obwohl in ihm längst steht, was der Ort ist, wer dort wohnt und
 * was ihn umgibt. Wer eine Karte zu „Möwenfurt" wollte, hat Möwenfurt ein
 * zweites Mal beschrieben.
 *
 * Dieses Modul ist die Übergabe. Es beantwortet zwei Fragen und sonst keine:
 *
 *   WELCHE Seiten kommen infrage — die Ort-Wikis mit räumlicher Ausdehnung.
 *   WIE wird eine davon zum Prompt — als kurze, lesbare, änderbare Vorlage.
 *
 * Was hier ausdrücklich NICHT passiert: der Volltext der Seite wird nicht
 * eingebaut. Er reist ohnehin mit, auf dem besseren Weg — das Bedienfeld gibt
 * den Slug als Ankerseite an die Brain-Aktion, und `buildContext` legt
 * Inhaltsblöcke, verknüpfte Seiten und Rückverweise selbst dazu, unter dem
 * Kontextbudget, das es verwaltet. Dieselbe Seite zweimal zu schicken wäre nur
 * doppelt lang.
 *
 * Die Vorlage bleibt deshalb bewusst dünn: Titel, Typ, Schlagworte, die
 * Zusammenfassung. Genug, damit der Spielleiter im Textfeld SIEHT, worauf die
 * Karte aufsetzt, und den Satz umschreiben kann, bevor er das Modell fragt.
 *
 * Ohne Abhängigkeiten — weder auf `@uwe/database` noch auf Prisma. Die Liste
 * der Seitentypen wird gegen die Navigationskategorie `orte` in
 * `ort-quelle.test.ts` geprüft; ein neuer Ort-Typ im Schema lässt dort einen
 * Test fallen, statt hier still zu fehlen. Das hält das Modul im
 * Client-Bündel des Bedienfelds unbedenklich.
 */

/**
 * Die Ort-Seitentypen, zu denen sich eine Karte bauen lässt.
 *
 * Die Navigationskategorie `orte` umfasst mehr (`trap`, `puzzle`, `loot`,
 * `secret`) — das sind aber Dinge IN einem Ort, keine Orte mit Ausdehnung.
 * Eine Fallgrube hat kein Biom, keine Flussrichtung und keine Siedlungen; sie
 * hier anzubieten wäre ein Versprechen, das der Generator nicht halten kann.
 */
export const TERRA_ORT_SEITENTYPEN = [
  "region",
  "location",
  "dungeon",
  "dungeon_level",
  "room",
] as const;

export type TerraOrtSeitentyp = (typeof TERRA_ORT_SEITENTYPEN)[number];

/** Anzeigenamen für die Auswahl. Deutsch wie die Oberfläche. */
export const TERRA_ORT_TYP_LABELS: Record<TerraOrtSeitentyp, string> = {
  region: "Region",
  location: "Ort",
  dungeon: "Dungeon",
  dungeon_level: "Dungeon-Ebene",
  room: "Raum",
};

/** Ein Ort-Wiki, so weit die Auswahl es braucht. Kein Inhaltsblock, kein Link. */
export interface TerraOrtQuelle {
  /** Ankerseite der Brain-Aktion — genau dieser Wert geht als `pageSlug` mit. */
  slug: string;
  titel: string;
  typ: TerraOrtSeitentyp;
  zusammenfassung: string | null;
  schlagworte: string[];
}

/**
 * Eingangsform: strukturell das, was `listPagesByWorld` liefert, ohne den Typ
 * zu importieren. So bleibt das Modul frei von Prisma — und nimmt trotzdem die
 * Seiten der Welt unverändert entgegen.
 */
export interface TerraOrtSeitenEingabe {
  slug: string;
  title: string;
  type: string;
  summary?: string | null;
  tags?: unknown;
}

/**
 * Höchstlänge des übernommenen Titels.
 *
 * `Page.title` ist im Schema unbegrenzt. Ohne diese Grenze frisst ein
 * ausufernder Titel das Budget der Vorlage — und weil der Anweisungssatz
 * ZULETZT steht, wäre ausgerechnet er das erste, was die Kürzung abschneidet.
 * Mit Deckeln auf Titel, Zusammenfassung und Schlagwortzahl passt die Vorlage
 * immer in `TERRA_ORT_PROMPT_MAX`, und der letzte Satz überlebt jeden Fall.
 */
const TITEL_MAX = 120;

/** Höchstlänge der übernommenen Zusammenfassung in der Vorlage. */
const ZUSAMMENFASSUNG_MAX = 700;

/** So viele Schlagworte reisen mit. Danach sagt eine Wortwolke nichts mehr. */
const SCHLAGWORTE_MAX = 8;

/**
 * Höchstlänge der erzeugten Vorlage.
 *
 * Das Bedienfeld erlaubt 2000 Zeichen (`TERRA_PROMPT_MAX`). Die Vorlage nimmt
 * bewusst nur einen Teil davon ein: was übrig bleibt, gehört dem Spielleiter,
 * der seine eigenen Sätze anhängt, ohne dass ihm das Feld unter der Hand
 * ausgeht.
 */
export const TERRA_ORT_PROMPT_MAX = 1200;

export function istTerraOrtSeitentyp(typ: string): typ is TerraOrtSeitentyp {
  return (TERRA_ORT_SEITENTYPEN as readonly string[]).includes(typ);
}

function schlagworteAus(roh: unknown): string[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>();
  const raus: string[] = [];
  for (const eintrag of roh) {
    if (typeof eintrag !== "string") continue;
    const wort = eintrag.trim();
    if (!wort || gesehen.has(wort.toLocaleLowerCase("de"))) continue;
    gesehen.add(wort.toLocaleLowerCase("de"));
    raus.push(wort);
    if (raus.length >= SCHLAGWORTE_MAX) break;
  }
  return raus;
}

function gekuerzt(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Filtert die Seiten einer Welt auf die bebaubaren Ort-Wikis und sortiert sie
 * so, wie man sie sucht: erst die weiten Räume (Region), dann die Orte, zuletzt
 * die einzelnen Kammern — innerhalb einer Stufe alphabetisch.
 */
export function ortQuellenAusSeiten(
  seiten: readonly TerraOrtSeitenEingabe[],
): TerraOrtQuelle[] {
  const quellen: TerraOrtQuelle[] = [];
  for (const seite of seiten) {
    if (!seite?.slug || !istTerraOrtSeitentyp(seite.type)) continue;
    const titel = seite.title?.trim();
    if (!titel) continue;
    const zusammenfassung = seite.summary?.trim();
    quellen.push({
      slug: seite.slug,
      titel: gekuerzt(titel, TITEL_MAX),
      typ: seite.type,
      zusammenfassung: zusammenfassung ? gekuerzt(zusammenfassung, ZUSAMMENFASSUNG_MAX) : null,
      schlagworte: schlagworteAus(seite.tags),
    });
  }

  return quellen.sort((a, b) => {
    const stufe = TERRA_ORT_SEITENTYPEN.indexOf(a.typ) - TERRA_ORT_SEITENTYPEN.indexOf(b.typ);
    return stufe !== 0 ? stufe : a.titel.localeCompare(b.titel, "de");
  });
}

/**
 * Die Vorlage für das Prompt-Feld.
 *
 * Der letzte Satz ist der wichtigste: er sagt dem Modell, dass das Wiki gilt
 * und es nur füllen soll, was dort fehlt. Ohne ihn liest ein kleines lokales
 * Modell den Kontext als Anregung statt als Vorgabe und erfindet neben dem Ort
 * her.
 */
export function baueTerraOrtPrompt(quelle: TerraOrtQuelle): string {
  /* Jeder Teil noch einmal gedeckelt — auch eine von Hand gebaute Quelle darf
     den Anweisungssatz am Ende nicht aus der Vorlage drängen. */
  const zeilen = [
    `Ort aus dem Wiki dieser Welt: „${gekuerzt(quelle.titel, TITEL_MAX)}" ` +
      `(${TERRA_ORT_TYP_LABELS[quelle.typ]}).`,
  ];
  if (quelle.schlagworte.length > 0) {
    zeilen.push(`Schlagworte: ${quelle.schlagworte.slice(0, SCHLAGWORTE_MAX).join(", ")}.`);
  }
  if (quelle.zusammenfassung) {
    zeilen.push(`Aus dem Wiki: ${gekuerzt(quelle.zusammenfassung, ZUSAMMENFASSUNG_MAX)}`);
  }
  zeilen.push(
    "Baue die Karte zu diesem Ort. Was im Wiki steht, gilt — ergänze nur, was dort fehlt.",
  );
  return gekuerzt(zeilen.join("\n"), TERRA_ORT_PROMPT_MAX);
}

export interface TerraOrtPromptWechsel {
  /** Was nach dem Wechsel im Prompt-Feld stehen soll. */
  prompt: string;
  /** true, wenn die neue Vorlage eingesetzt wurde (Merkposten für den nächsten Wechsel). */
  vorlageUebernommen: boolean;
}

/**
 * Was ein Wechsel im Ort-Auswahlfeld mit dem Prompt-Feld machen darf.
 *
 * Eine Regel, aber eine, die man leicht falsch herum baut: die Vorlage
 * ERSETZT nur, was sie selbst hineingeschrieben hat. Steht dort ein eigener
 * Text — getippt oder eine zurechtgeschriebene frühere Vorlage —, bleibt er.
 *
 * Sonst kostet ein Fehlgriff im Auswahlfeld drei formulierte Sätze, und ein
 * Textfeld, das ungefragt löscht, benutzt niemand ein zweites Mal.
 *
 * `letzteVorlage` ist der Text, den dieses Bedienfeld zuletzt selbst gesetzt
 * hat — leer, solange es das noch nie getan hat.
 */
export function promptNachOrtwechsel(input: {
  aktuell: string;
  letzteVorlage: string;
  neueVorlage: string;
}): TerraOrtPromptWechsel {
  const eigenerText = input.aktuell.trim() !== "" && input.aktuell !== input.letzteVorlage;
  if (eigenerText) return { prompt: input.aktuell, vorlageUebernommen: false };
  return { prompt: input.neueVorlage, vorlageUebernommen: true };
}
