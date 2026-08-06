/**
 * Talente — vollständig nach SRD 5.2.1, in den vier Kategorien der Regeln
 * von 2024: Herkunft, Allgemein, Kampfstil, Epische Gabe.
 *
 * Geprüft am 2026-08-06 gegen die offizielle PDF `SRD_CC_v5.2.1`
 * (Abschnitt „Feats“, S. 86–88) und zwei unabhängige Markdown-Konversionen
 * derselben Datei. Der SRD-Bestand ist deutlich kleiner als das
 * Spielerhandbuch 2024:
 *
 * - Herkunft:     Alert, Magic Initiate, Savage Attacker, Skilled
 * - Allgemein:    Ability Score Improvement, Grappler
 * - Kampfstil:    Archery, Defense, Great Weapon Fighting, Two-Weapon Fighting
 * - Epische Gabe: sieben „Boon of …“
 *
 * // TODO(unverified): Crafter, Healer, Lucky, Musician, Tavern Brawler,
 * // Tough sind Ursprungstalente des PHB 2024, stehen aber **nicht** im
 * // SRD 5.2.1 — ebenso wenig die Kampfstile Blind Fighting, Dueling,
 * // Interception, Protection, Thrown Weapon Fighting und Unarmed Fighting
 * // oder die allgemeinen Talente jenseits von Grappler. Nicht aus dem
 * // Gedächtnis ergänzen; sie sind weder nachprüfbar noch CC-BY-4.0.
 *
 * **Eine bewusste Auffächerung:** Das SRD druckt *ein* Talent „Magic
 * Initiate“, dessen Zauberliste beim Erwerb gewählt wird (und das genau
 * deshalb wiederholbar ist). Die Hintergründe verweisen aber wörtlich auf
 * „Magic Initiate (Cleric)“ bzw. „Magic Initiate (Wizard)“. Damit
 * `Background.originFeat` das trifft, was auf dem Charakterbogen steht,
 * liegt das Talent hier dreimal vor — je einmal mit gebundener Liste.
 * Regeltext identisch, nur die Liste ist festgelegt.
 *
 * Deutsche Namen folgen der deutschen SRD-5.2.1-Fassung.
 */

import { SRD_SOURCE, type Feat } from "../types";

/** Alle sechs Attribute — für Talente, die „ein Attribut deiner Wahl“ sagen. */
const ANY_ABILITY = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

/** Der gemeinsame Regeltext von „Eingeweihter der Magie“, Liste offen. */
function magicInitiate(
  key: string,
  listDe: string,
  listEn: string,
  hook: string,
): Feat {
  return {
    key,
    name: `Eingeweihter der Magie (${listDe})`,
    nameEn: `Magic Initiate (${listEn})`,
    hook,
    description:
      `Ein Fuß in der Magie, ohne einen einzigen Grad in einer Zaubererklasse: ` +
      `zwei Zaubertricks und ein Zauber des 1. Grades von der ${listDe}-Liste, ` +
      `dauerhaft vorbereitet.`,
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Zwei Zaubertricks",
        description:
          `Du beherrschst zwei Zaubertricks deiner Wahl aus der ${listDe}-Zauberliste. ` +
          "Dein Attribut zum Wirken der Zauber dieses Talents ist Intelligenz, " +
          "Weisheit oder Charisma — die Wahl triffst du, wenn du das Talent nimmst.",
        level: 1,
      },
      {
        name: "Zauber des 1. Grades",
        description:
          `Wähle einen Zauber des 1. Grades aus der ${listDe}-Zauberliste. Du hast ihn ` +
          "stets vorbereitet. Du kannst ihn einmal ohne Zauberplatz wirken und " +
          "erhältst diese Möglichkeit nach einer langen Rast zurück; mit Zauberplätzen, " +
          "über die du verfügst, kannst du ihn zusätzlich wirken.",
        level: 1,
      },
      {
        name: "Zauberwechsel",
        description:
          "Immer wenn du eine neue Stufe erreichst, darfst du einen der für dieses " +
          "Talent gewählten Zauber gegen einen anderen desselben Grades aus derselben " +
          "Liste austauschen.",
        level: 1,
      },
      {
        name: "Kann wiederholt werden",
        description:
          "Du kannst dieses Talent mehrmals nehmen, musst aber jedes Mal eine andere " +
          "Zauberliste wählen (Kleriker, Druide oder Magier).",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  };
}

export const FEATS: Feat[] = [
  // ───────────────────────── Herkunftstalente ─────────────────────────
  {
    key: "wachsam",
    name: "Wachsam",
    nameEn: "Alert",
    hook: "Du bist schon in Deckung, während die anderen noch nach der Waffe greifen.",
    description:
      "Du reagierst früher als der Rest der Gruppe — und wenn es einmal wichtiger " +
      "ist, dass jemand anderes zuerst handelt, tauschst du kurzerhand den Platz.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Initiative-Übung",
        description:
          "Wenn du Initiative würfelst, darfst du deinen Übungsbonus addieren.",
        level: 1,
      },
      {
        name: "Initiativetausch",
        description:
          "Sofort nach dem Initiativewurf darfst du deine Initiative mit der eines " +
          "bereitwilligen Verbündeten im selben Kampf tauschen. Der Tausch entfällt, " +
          "wenn du oder der Verbündete kampfunfähig ist.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  magicInitiate(
    "eingeweihter-der-magie-kleriker",
    "Kleriker",
    "Cleric",
    "Heilung und Segen aus dem Tempel — auch für einen Charakter, der nie einen Klerikergrad nimmt.",
  ),
  magicInitiate(
    "eingeweihter-der-magie-druide",
    "Druide",
    "Druid",
    "Ein Stück Wildnis im Gepäck: Dornen, Ranken und ein Feuer, das du nicht anzünden musst.",
  ),
  magicInitiate(
    "eingeweihter-der-magie-magier",
    "Magier",
    "Wizard",
    "Zwei Zaubertricks aus dem Studierzimmer — genug, um jeder Klasse eine arkane Notlösung zu geben.",
  ),

  {
    key: "wilder-angreifer",
    name: "Wilder Angreifer",
    nameEn: "Savage Attacker",
    hook: "Einmal pro Zug zählt der schlechte Schadenswurf einfach nicht.",
    description:
      "Du bist darin ausgebildet, besonders schadensintensive Schläge auszuführen. " +
      "Das Talent glättet genau die Runden, in denen der große Treffer für zwei " +
      "Punkte Schaden sorgt — besonders wertvoll bei wenigen, großen Waffenwürfeln.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Zweimal würfeln",
        description:
          "Einmal pro Zug darfst du, wenn du ein Ziel mit einer Waffe triffst, die " +
          "Schadenswürfel der Waffe zweimal werfen und dir eines der beiden Ergebnisse " +
          "aussuchen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  {
    key: "begabt",
    name: "Begabt",
    nameEn: "Skilled",
    hook: "Drei Dinge mehr, die du kannst — such sie dir selbst aus.",
    description:
      "Das breiteste Ursprungstalent im SRD: drei zusätzliche Übungen, beliebig " +
      "auf Fertigkeiten und Werkzeuge verteilt. Ideal, wenn Klasse und Hintergrund " +
      "die eine Fertigkeit nicht abdecken, die dein Charakterkonzept eigentlich braucht.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Drei Übungen",
        description:
          "Du bist in drei Fertigkeiten oder Werkzeugen deiner Wahl geübt, in beliebiger " +
          "Kombination.",
        level: 1,
      },
      {
        name: "Kann wiederholt werden",
        description: "Du kannst dieses Talent mehrmals nehmen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  // ───────────────────────── Allgemeine Talente ─────────────────────────
  {
    key: "attributswerterhoehung",
    name: "Attributswerterhöhung",
    nameEn: "Ability Score Improvement",
    hook: "Die schlichte Alternative zu jedem anderen Talent: zwei Punkte mehr auf das, was du ohnehin am meisten würfelst.",
    description:
      "Das Standardtalent, das die meisten Klassen auf den Stufen 4, 8, 12 und 16 " +
      "anbieten. Es steht bewusst in der allgemeinen Kategorie, damit man es " +
      "gegen jedes andere allgemeine Talent abwägen kann.",
    category: "general",
    prerequisite: "Mindestens Stufe 4",
    benefits: [
      {
        name: "Erhöhung",
        description:
          "Erhöhe einen Attributswert deiner Wahl um 2 oder zwei Attributswerte um je 1. " +
          "Kein Wert darf dadurch über 20 steigen.",
        level: 4,
      },
      {
        name: "Kann wiederholt werden",
        description: "Du kannst dieses Talent mehrmals nehmen.",
        level: 4,
      },
    ],
    // Passt nicht in die Form `choose: 1 / amount: 1` — +2 auf eines *oder*
    // +1 auf zwei. Steht deshalb nur im Regeltext, nicht in `abilityIncrease`.
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  {
    key: "ringer",
    name: "Ringer",
    nameEn: "Grappler",
    hook: "Du hältst fest, was du triffst — und alles, was danach auf das Ziel einprügelt, trifft leichter.",
    description:
      "Das einzige allgemeine Talent des SRD neben der Attributswerterhöhung. Es " +
      "macht das Packen von einer Notlösung zu einer echten Taktik: schlagen und " +
      "packen im selben Angriff, Vorteil danach, und keine Bewegungsstrafe beim " +
      "Wegschleppen.",
    category: "general",
    prerequisite: "Mindestens Stufe 4; Stärke oder Geschicklichkeit 13+",
    benefits: [
      {
        name: "Zuschlagen und packen",
        description:
          "Triffst du eine Kreatur im Rahmen der Angriffsaktion mit einem waffenlosen " +
          "Angriff, darfst du sowohl Schaden bewirken als auch die Packen-Option " +
          "verwenden. Einmal pro Zug.",
        level: 4,
      },
      {
        name: "Angriffsvorteil",
        description:
          "Du bist bei Angriffswürfen gegen eine Kreatur, die du gepackt hältst, im Vorteil.",
        level: 4,
      },
      {
        name: "Flinker Ringer",
        description:
          "Du verbrauchst keine zusätzliche Bewegung, wenn du eine gepackte Kreatur " +
          "bewegst, sofern sie höchstens so groß ist wie du.",
        level: 4,
      },
    ],
    abilityIncrease: { choose: 1, from: ["strength", "dexterity"], amount: 1 },
    source: SRD_SOURCE,
  },

  // ───────────────────────── Kampfstil-Talente ─────────────────────────
  // Kämpfer, Paladin und Waldläufer wählen hieraus. Das SRD nennt genau vier.
  {
    key: "bogenschiessen",
    name: "Bogenschießen",
    nameEn: "Archery",
    hook: "+2 auf jeden Fernkampf-Angriffswurf — der größte reine Trefferbonus im SRD.",
    description:
      "Der Kampfstil für alle, die aus der zweiten Reihe arbeiten. Der Bonus gilt " +
      "für jede Fernkampfwaffe, unabhängig von Munition oder Reichweite.",
    category: "fighting_style",
    prerequisite: "Merkmal „Kampfstil“",
    benefits: [
      {
        name: "Zielsicher",
        description: "Du erhältst +2 auf Angriffswürfe mit Fernkampfwaffen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  {
    key: "verteidigung",
    name: "Verteidigung",
    nameEn: "Defense",
    hook: "+1 Rüstungsklasse, solange du Rüstung trägst — die Wahl, die im SRD ausdrücklich empfohlen wird.",
    description:
      "Unspektakulär und deshalb fast immer richtig: Ein Punkt Rüstungsklasse " +
      "wirkt gegen jeden Angriff und in jeder Runde. Die Kämpfer-Beschreibung des " +
      "SRD empfiehlt diesen Stil ausdrücklich für den Einstieg.",
    category: "fighting_style",
    prerequisite: "Merkmal „Kampfstil“",
    benefits: [
      {
        name: "Rüstungsbonus",
        description:
          "Solange du leichte, mittelschwere oder schwere Rüstung trägst, erhältst du " +
          "+1 auf die Rüstungsklasse.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  {
    key: "kampf-mit-grossen-waffen",
    name: "Kampf mit großen Waffen",
    nameEn: "Great Weapon Fighting",
    hook: "Jede 1 und jede 2 auf dem Schadenswürfel wird zur 3 — die Zweihänder-Versicherung.",
    description:
      "Für Charaktere, die mit beiden Händen zuschlagen. Der Stil hebt nicht den " +
      "Durchschnitt dramatisch an, aber er nimmt der großen Waffe die Enttäuschung: " +
      "ein Greatsword-Wurf von 1+2 wird zu 3+3.",
    category: "fighting_style",
    prerequisite: "Merkmal „Kampfstil“",
    benefits: [
      {
        name: "Mindestens eine 3",
        description:
          "Wenn du den Schaden eines Angriffs mit einer Nahkampfwaffe auswürfelst, die du " +
          "mit beiden Händen hältst, wertest du jede 1 und jede 2 auf einem Schadenswürfel " +
          "als 3. Die Waffe muss die Eigenschaft Zweihändig oder Vielseitig besitzen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  {
    key: "zwei-waffen-kampf",
    name: "Zwei-Waffen-Kampf",
    nameEn: "Two-Weapon Fighting",
    hook: "Auch der zweite Angriff bekommt deinen Attributsmodifikator auf den Schaden.",
    description:
      "Ohne diesen Stil bleibt der Zusatzangriff mit einer leichten Waffe " +
      "Schadenswürfel pur. Mit ihm zählt er wie ein voller Treffer — das ist der " +
      "eigentliche Unterschied zwischen zwei Waffen und einer.",
    category: "fighting_style",
    prerequisite: "Merkmal „Kampfstil“",
    benefits: [
      {
        name: "Voller Schaden beidhändig",
        description:
          "Wenn du dank der Eigenschaft Leicht einer Waffe einen zusätzlichen Angriff " +
          "ausführst, darfst du dem Schaden deinen Attributsmodifikator hinzufügen, " +
          "sofern du das nicht ohnehin schon tust.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: SRD_SOURCE,
  },

  // ─────────────────────── Epische-Gabe-Talente ───────────────────────
  // Für den Ersteller auf Stufe 1 irrelevant, aber Teil des SRD-Katalogs.
  // Alle erhöhen ein Attribut um 1, hier bis maximal 30 statt 20.
  {
    key: "gabe-der-kampffertigkeit",
    name: "Gabe der Kampffertigkeit",
    nameEn: "Boon of Combat Prowess",
    hook: "Ein verfehlter Angriff pro Runde ist keiner mehr — du triffst einfach doch.",
    description:
      "Die Gabe der reinen Waffengewalt. Praktisch bedeutet sie einen garantierten " +
      "Treffer pro Runde, gerade dann, wenn der wichtigste Angriff danebengeht.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Unübertroffenes Zielen",
        description:
          "Wenn du mit einem Angriffswurf nicht triffst, kannst du stattdessen treffen. " +
          "Danach erst wieder ab Beginn deines nächsten Zuges nutzbar.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Ein Attributswert deiner Wahl steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: [...ANY_ABILITY], amount: 1 },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-des-dimensionsreisens",
    name: "Gabe des Dimensionsreisens",
    nameEn: "Boon of Dimensional Travel",
    hook: "Nach jedem Angriff und jeder magischen Aktion bist du neun Meter weiter — ohne Aktion, ohne Zauber.",
    description:
      "Freie Beweglichkeit als Dauerzustand: Du schlägst zu und stehst danach dort, " +
      "wo der Gegner dich nicht haben will.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Flimmerschritte",
        description:
          "Sofort nachdem du die Angriffsaktion oder die magische Aktion ausgeführt hast, " +
          "kannst du dich bis zu neun Meter weit in einen freien, sichtbaren Bereich " +
          "teleportieren.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Ein Attributswert deiner Wahl steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: [...ANY_ABILITY], amount: 1 },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-des-schicksals",
    name: "Gabe des Schicksals",
    nameEn: "Boon of Fate",
    hook: "Du drehst einen fremden Wurf im Umkreis von 18 Metern — nach oben oder nach unten.",
    description:
      "Die Gabe für alle, die den entscheidenden Moment nicht dem Zufall überlassen " +
      "wollen — auch nicht den Moment eines anderen.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Schicksal verbessern",
        description:
          "Wenn du oder eine Kreatur im Umkreis von 18 Metern eine W20-Prüfung besteht " +
          "oder nicht besteht, kannst du 2W4 würfeln und das Ergebnis als Bonus oder " +
          "Malus anwenden. Erst nach einem Initiativewurf oder einer kurzen oder langen " +
          "Rast erneut nutzbar.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Ein Attributswert deiner Wahl steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: [...ANY_ABILITY], amount: 1 },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-des-unwiderstehlichen-angriffs",
    name: "Gabe des Unwiderstehlichen Angriffs",
    nameEn: "Boon of Irresistible Offense",
    hook: "Resistenz gegen Hieb, Stich und Wucht hilft gegen dich nicht mehr.",
    description:
      "Die Antwort auf alles, was körperlichen Schaden abfedert — plus ein " +
      "gewaltiger Zuschlag bei jedem kritischen Treffer.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Verteidigung überwinden",
        description:
          "Der Hieb-, Stich- und Wuchtschaden, den du verursachst, ignoriert Resistenz.",
        level: 19,
      },
      {
        name: "Überwältigender Schlag",
        description:
          "Würfelst du bei einem Angriffswurf eine 20, kannst du zusätzlichen Schaden in " +
          "Höhe des durch dieses Talent erhöhten Attributswerts zufügen, in derselben " +
          "Schadensart wie der Angriff.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Stärke oder Geschicklichkeit steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: ["strength", "dexterity"], amount: 1 },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-der-zaubererinnerung",
    name: "Gabe der Zaubererinnerung",
    nameEn: "Boon of Spell Recall",
    hook: "Jeder Zauberplatz vom 1. bis 4. Grad kann sich selbst zurückgeben.",
    description:
      "Ein Viertel deiner kleinen Zauberplätze überlebt statistisch das Wirken — auf " +
      "hoher Stufe ist das ein ganzer zweiter Zaubertag.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19; Merkmal „Zauberwirken“",
    benefits: [
      {
        name: "Freies Zauberwirken",
        description:
          "Wirkst du einen Zauber mit einem Zauberplatz des 1. bis 4. Grades, würfle 1W4. " +
          "Entspricht das Ergebnis dem Grad des Platzes, wird er nicht verbraucht.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Intelligenz, Weisheit oder Charisma steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: {
      choose: 1,
      from: ["intelligence", "wisdom", "charisma"],
      amount: 1,
    },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-des-nachtgeists",
    name: "Gabe des Nachtgeists",
    nameEn: "Boon of the Night Spirit",
    hook: "Im Halbdunkel bist du unsichtbar und gegen fast alles resistent — Licht ist deine einzige Schwäche.",
    description:
      "Die Gabe verwandelt jeden schlecht beleuchteten Raum in deinen Vorteil: " +
      "Unsichtbarkeit als Bonusaktion und Resistenz gegen alles außer Gleißend und " +
      "Psychisch.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Schattentarnung",
        description:
          "In dämmrigem Licht oder Dunkelheit kannst du dich als Bonusaktion unsichtbar " +
          "machen. Der Zustand endet, sobald du eine Aktion, Bonusaktion oder Reaktion " +
          "ausführst.",
        level: 19,
      },
      {
        name: "Schattige Gestalt",
        description:
          "In dämmrigem Licht oder Dunkelheit bist du gegen jede Schadensart außer " +
          "Psychisch und Gleißend resistent.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Ein Attributswert deiner Wahl steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: [...ANY_ABILITY], amount: 1 },
    source: SRD_SOURCE,
  },

  {
    key: "gabe-des-wahren-blicks",
    name: "Gabe des Wahren Blicks",
    nameEn: "Boon of Truesight",
    hook: "Keine Illusion, keine Unsichtbarkeit und keine Gestaltwandlung hält vor dir auf 18 Metern.",
    description:
      "Wahrer Blick als Dauerzustand. Auf epischer Stufe ist das weniger ein " +
      "Kampfvorteil als eine Absage an eine ganze Kategorie von Fallen.",
    category: "epic_boon",
    prerequisite: "Mindestens Stufe 19",
    benefits: [
      {
        name: "Wahrer Blick",
        description: "Du hast Wahren Blick mit einer Reichweite von 18 Metern.",
        level: 19,
      },
      {
        name: "Attributswerterhöhung",
        description:
          "Ein Attributswert deiner Wahl steigt um 1, auf höchstens 30.",
        level: 19,
      },
    ],
    abilityIncrease: { choose: 1, from: [...ANY_ABILITY], amount: 1 },
    source: SRD_SOURCE,
  },
];

/** Talent per Schlüssel nachschlagen. */
export function findFeat(key: string): Feat | undefined {
  return FEATS.find((entry) => entry.key === key);
}
