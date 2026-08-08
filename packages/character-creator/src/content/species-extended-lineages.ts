/**
 * Abstammungen für Owner-Notizen-Spezies (nicht SRD).
 *
 * Ausgelagert aus `species-extended.ts` wegen Zeilenbudget (CLAUDE.md § Modul-Disziplin).
 */

import { OWNER_NOTES_SOURCE, type SpeciesLineage, type Trait } from "../types";

function goblinoidTypeTrait(): Trait {
  return {
    name: "Goblinoid",
    description:
      "Du zählst als Humanoid und als Goblinoid für Voraussetzungen und Effekte, die ein Goblinoid verlangen.",
    level: 1,
  };
}

/** Goblin — klein, wendig, listig. */
export const GOBLIN_LINEAGE: SpeciesLineage = {
  key: "goblin",
  name: "Goblin",
  nameEn: "Goblin",
  hook: "Klein genug für die Ritze, hungrig genug für den Plan — und flink genug, um zu verschwinden, bevor die Antwort kommt.",
  description:
    "Goblins sind schnell, opportunistisch und anpassungsfähig. Am Tisch bedeuten sie Bonusaktions-Disengage oder Hide, Vorteil gegen Bezaubern und extra Schaden gegen größere Gegner.",
  source: OWNER_NOTES_SOURCE,
  size: "small",
  traits: [
    goblinoidTypeTrait(),
    {
      name: "Dunkelsicht",
      description:
        "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß. In Dunkelheit siehst du nur Graustufen.",
      level: 1,
    },
    {
      name: "Feenblut",
      description: "Du bist bei Rettungswürfen im Vorteil, mit denen du den Zustand Bezaubert vermeidest.",
      level: 1,
    },
    {
      name: "Wut des Kleinen",
      description:
        "Triffst du mit Angriff oder Zauber eine Kreatur, die größer ist als du, kannst du extra Schaden in Höhe deines Übungsbonus verursachen. Anwendungen wie dein Übungsbonus pro langer Rast, höchstens einmal pro Zug.",
      level: 1,
    },
    {
      name: "Wendige Flucht",
      description:
        "Du kannst auf jedem deiner Züge die Aktionen Entfernen oder Verstecken als Bonusaktion ausführen.",
      level: 1,
    },
  ],
};

/** Hobgoblin — diszipliniert, taktisch. */
export const HOBGOBLIN_LINEAGE: SpeciesLineage = {
  key: "hobgoblin",
  name: "Hobgoblin",
  nameEn: "Hobgoblin",
  hook: "Rang, Ordnung und ein Bonuswurf, wenn die Gruppe hinter dir steht — Hobgoblins gewinnen Kämpfe vor dem ersten Hieb.",
  description:
    "Hobgoblins sind größer als Goblins, militärisch gedacht und an Bündnisse gewöhnt. Ihr Help-Bonus und „Fortune from the Many“ belohnen koordinierte Gruppen.",
  source: OWNER_NOTES_SOURCE,
  traits: [
    goblinoidTypeTrait(),
    {
      name: "Dunkelsicht",
      description:
        "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß. In Dunkelheit siehst du nur Graustufen.",
      level: 1,
    },
    {
      name: "Feenblut",
      description:
        "Du bist bei Rettungswürfen im Vorteil, mit denen du den Zustand Bezaubert vermeidest oder beendest.",
      level: 1,
    },
    {
      name: "Segen der Vielen",
      description:
        "Scheitert eine W20-Prüfung, kannst du einen Bonus in Höhe sichtbarer Verbündeter innerhalb von 30 Fuß (max. +3) erhalten. Anwendungen wie dein Übungsbonus, zurück nach langer Rast.",
      level: 1,
    },
    {
      name: "Gabe der Herrschaft",
      description:
        "Du kannst die Help-Aktion als Bonusaktion ausführen (Anwendungen wie Übungsbonus, lange Rast). Wähle pro Help: Hospitality (+1W6+PB temporäre Trefferpunkte für euch beide), Passage (+10 Fuß Bewegungsrate bis Zugbeginn) oder Spite (Nachteil auf nächsten Angriff des Geholenen).",
      level: 1,
    },
  ],
};

/** Bugbear — langarmig, schleichend, brutal im Eröffnungszug. */
export const BUGBEAR_LINEAGE: SpeciesLineage = {
  key: "bugbear",
  name: "Bugbear",
  nameEn: "Bugbear",
  hook: "Eine Klaue aus dem Schatten, zwei W6 extra, wenn du zuerst zuschlägst — Bugbears leben vom Überraschungsmoment.",
  description:
    "Bugbears sind groß, behaart und leise trotz ihrer Statur. Lange Gliedmaßen, Überraschungsangriff und Powerful Build machen sie zu gefährlichen Eröffnern.",
  source: OWNER_NOTES_SOURCE,
  traits: [
    goblinoidTypeTrait(),
    {
      name: "Dunkelsicht",
      description:
        "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß. In Dunkelheit siehst du nur Graustufen.",
      level: 1,
    },
    {
      name: "Feenblut",
      description: "Du bist bei Rettungswürfen im Vorteil, mit denen du den Zustand Bezaubert vermeidest.",
      level: 1,
    },
    {
      name: "Lange Gliedmaßen",
      description: "Bei einem Nahkampfangriff in deinem Zug ist deine Reichweite 5 Fuß größer als normal.",
      level: 1,
    },
    {
      name: "Kräftiger Körperbau",
      description:
        "Du zählst für Traglast und Schieben/Ziehen/Heben als eine Größenkategorie größer.",
      level: 1,
    },
    {
      name: "Schleichend",
      description: "Du bist in der Fertigkeit Stealth geübt.",
      level: 1,
    },
    {
      name: "Überraschungsangriff",
      description:
        "Triffst du im Kampf eine Kreatur, die ihren ersten Zug noch nicht hatte, fügt der Treffer extra 2W6 Schaden zu — einmal pro Kampf.",
      level: 1,
    },
  ],
};

export const GOBLINKIN_LINEAGES: SpeciesLineage[] = [
  GOBLIN_LINEAGE,
  HOBGOBLIN_LINEAGE,
  BUGBEAR_LINEAGE,
];

/** Kathai — College of Dynamics. */
export const KATHAI_DYNAMICS_LINEAGE: SpeciesLineage = {
  key: "dynamics",
  name: "College of Dynamics",
  nameEn: "College of Dynamics",
  hook: "Minor Illusion, Disguise Self und ab Stufe 5 Invisibility — Form und Maske.",
  description:
    "Das College of Dynamics lehrt Illusion und Verstellung. Zauberattribut für diese Merkmale: Intelligence, Wisdom oder Charisma.",
  source: OWNER_NOTES_SOURCE,
  traits: [
    {
      name: "College of Dynamics",
      description:
        "Du kennst Minor Illusion. Disguise Self immer vorbereitet — einmal ohne Spell Slot pro langer Rast " +
        "(auch mit Spell Slots). Ab Stufe 5 ebenso Invisibility. Zauberattribut: Intelligence, Wisdom oder Charisma.",
      level: 1,
    },
  ],
};

/** Kathai — College of Statics. */
export const KATHAI_STATICS_LINEAGE: SpeciesLineage = {
  key: "statics",
  name: "College of Statics",
  nameEn: "College of Statics",
  hook: "Mending, Prestidigitation und winzige Uhrwerke — drei Geräte, acht Stunden.",
  description:
    "Das College of Statics formt Prestidigitation zu Tiny-Clockwork-Geräten. Zauberattribut: Intelligence, Wisdom oder Charisma.",
  source: OWNER_NOTES_SOURCE,
  traits: [
    {
      name: "College of Statics",
      description:
        "Du kennst Mending und Prestidigitation. 10 Minuten Prestidigitation: Tiny-Gerät (AC 5, 1 TP) mit einem " +
        "Prestidigitation-Effekt (Bonusaktion berühren). Max. 3 Geräte; zerfallen nach 8 Stunden oder bei Utilize-Abbau. " +
        "Zauberattribut: Intelligence, Wisdom oder Charisma.",
      level: 1,
    },
  ],
};

/** Kathai — College of Synergetics. */
export const KATHAI_SYNERGETICS_LINEAGE: SpeciesLineage = {
  key: "synergetics",
  name: "College of Synergetics",
  nameEn: "College of Synergetics",
  hook: "Alarm, Mage Armor und ab Stufe 5 Arcane Lock — Schutz als System.",
  description:
    "Das College of Synergetics koppelt Schutzzauber. Zauberattribut: Intelligence, Wisdom oder Charisma.",
  source: OWNER_NOTES_SOURCE,
  traits: [
    {
      name: "College of Synergetics",
      description:
        "Alarm und Mage Armor immer vorbereitet — je einmal ohne Spell Slot pro langer Rast (auch mit Spell Slots). " +
        "Ab Stufe 5 ebenso Arcane Lock. Zauberattribut: Intelligence, Wisdom oder Charisma.",
      level: 1,
    },
  ],
};

export const KATHAI_LINEAGES: SpeciesLineage[] = [
  KATHAI_DYNAMICS_LINEAGE,
  KATHAI_STATICS_LINEAGE,
  KATHAI_SYNERGETICS_LINEAGE,
];
