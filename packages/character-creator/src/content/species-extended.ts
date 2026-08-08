/**
 * Erweiterte Spezies aus Owner-Notizen (Kanka-Export / Tegora-Quelle).
 *
 * Ergänzen die neun SRD-Spezies in `species.ts`. Mechanik aus den Owner-Notizen,
 * Flavour für Terra (Validori / Nepurga / Arbor-Saum) umgeschrieben — keine
 * Tegora-/FR-Referenzen.
 *
 * Ability-Anzeigenamen in Prosa: Strength, Dexterity, Constitution,
 * Intelligence, Wisdom, Charisma (englisch, Produktregel).
 *
 * Abstammungen: `species-extended-lineages.ts`.
 * Phase 2: `species-extended-phase2.ts` (wird unten eingemischt).
 */

import { OWNER_NOTES_SOURCE, type Species } from "../types";
import { GOBLINKIN_LINEAGES } from "./species-extended-lineages";
import { SPECIES_EXTENDED_PHASE2 } from "./species-extended-phase2";

/** Die nicht-SRD-Völker aus den Owner-Notizen (Phase 1). */
const SPECIES_EXTENDED_PHASE1: Species[] = [
  {
    key: "goblinkin",
    name: "Goblinkin",
    nameEn: "Goblinkin",
    hook:
      "Drei Gestalten, ein Hunger: Goblin, Hobgoblin oder Bugbear — wähle, wie du an den Rändern von Nepurga und Validori überlebst.",
    description:
      "Goblinkin sind anpassungsfähige Grenzbewohner — schnell, listig oder schwer, je nach Abstammung. " +
      "Am Tisch wählst du Goblin (klein, Bonusaktions-Flucht), Hobgoblin (Help und Gruppenbonus) oder Bugbear (Reichweite und Überraschung).\n\n" +
      "Flavour: Karawanen am Inneren Meer kennen ihre Spuren; Magister in Validori nennen sie Randvolk, " +
      "nicht Bürger — trotzdem laufen Handelswege auch durch ihr Territorium.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 60,
    lineageLabel: "Goblinkin-Abstammung",
    lineages: GOBLINKIN_LINEAGES,
    traits: [
      {
        name: "Gob-Shaping",
        description:
          "Du wählst eine Abstammung (Goblin = Small, Hobgoblin oder Bugbear = Medium). Merkmale folgen der Wahl.",
        level: 1,
      },
    ],
  },
  {
    key: "lizardfolk",
    name: "Lizardfolk",
    nameEn: "Lizardfolk",
    hook: "Natürliche Rüstung, Biss als Waffe und ein hungriger Kiefer, der dir Trefferpunkte zurückgibt.",
    description:
      "Lizardfolk sind reptilienhafte Humanoids mit Schwimmgeschwindigkeit, Natürlicher Rüstung (AC 13 + Dexterity) " +
      "und Hungry Jaws für temporäre Trefferpunkte nach einem Biss.\n\n" +
      "Flavour: Feuchtgebiete südlich Validoris und alte Tempelanlagen am Inneren Meer — Patienten der Chronik, " +
      "nicht Touristenattraktion.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Biss",
        description:
          "Dein Gebiss ist eine Nahkampfwaffe: 1W6 + Strength-Modifikator Slashing statt normalen Waffenschadens.",
        level: 1,
      },
      {
        name: "Atem anhalten",
        description: "Du kannst den Atem bis zu einer Stunde anhalten.",
        level: 1,
      },
      {
        name: "Hungrige Kiefer",
        description:
          "Bonusaktion: Spezialangriff mit Biss; bei Treffer normaler Schaden plus temporäre Trefferpunkte in Höhe deines Übungsbonus. Anwendungen wie Übungsbonus, lange Rast.",
        level: 1,
      },
      {
        name: "Natürliche Rüstung",
        description:
          "Ohne Rüstung: AC 13 + Dexterity-Modifikator (Schild normal). Schwimmen: Bewegungsrate 30 Fuß.",
        level: 1,
      },
      {
        name: "Naturinstinkt",
        description:
          "Übung in zwei Fertigkeiten deiner Wahl: Animal Handling, Medicine, Nature, Perception, Stealth oder Survival.",
        level: 1,
      },
    ],
  },
  {
    key: "minotaur",
    name: "Minotaur",
    nameEn: "Minotaur",
    hook: "Hörner, Sturmangriff und ein innerer Kompass — Minotauren erinnern sich an jeden Pfad.",
    description:
      "Minotauren bringen Hornstoß (1W6 + Strength), Goring Rush nach Dash, Hammering Horns zum Wegschieben " +
      "und Labyrinthine Recall für Navigation.\n\n" +
      "Flavour: Bergpässe zwischen Nepurga und dem Arbor-Saum; Ehre als Erbe, nicht als Mode.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Hörner",
        description: "Hörner als Nahkampfwaffe: 1W6 + Strength Piercing.",
        level: 1,
      },
      {
        name: "Stoßangriff",
        description:
          "Nach Dash und mindestens 20 Fuß Bewegung: Bonusaktion-Hornangriff in dem Zug.",
        level: 1,
      },
      {
        name: "Hämmernde Hörner",
        description:
          "Nach Treffer in der Angriffsaktion: Bonusaktion Stoßen (Ziel max. eine Größe größer, 5 Fuß). Strength-SG 8 + PB + Strength.",
        level: 1,
      },
      {
        name: "Labyrinth-Erinnerung",
        description: "Du kennst immer die Himmelsrichtung Norden und hast Vorteil auf Survival für Navigation/Spuren.",
        level: 1,
      },
    ],
  },
  {
    key: "centaur",
    name: "Centaur",
    nameEn: "Centaur",
    hook: "40 Fuß Tempo, Hufe und Charge — wer dich unterschätzt, sieht dich schon im nächsten Zug.",
    description:
      "Centauren sind Fey mit 40 Fuß Bewegungsrate, Hufschlag, Charge nach 20 Fuß Anlauf, Equine Build und Survivor-Fertigkeit.\n\n" +
      "Flavour: Steppen und offene Wege fern der Magister-Alleen — direkte Worte, Ahnengeister in lebenden Bäumen.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 40,
    darkvision: null,
    traits: [
      {
        name: "Hufe",
        description: "Hufe als Nahkampfwaffe: 1W6 + Strength Bludgeoning.",
        level: 1,
      },
      {
        name: "Charge",
        description:
          "Mindestens 20 Fuß geradeaus und Treffer mit Nahkampfwaffe: Bonusaktion-Hufangriff gegen dasselbe Ziel.",
        level: 1,
      },
      {
        name: "Pferdeleib",
        description:
          "Vorteil zum Beenden von Grappled; Traglast eine Größenkategorie größer. Klettern mit Händen+ Füßen kostet 4 Fuß extra pro Fuß.",
        level: 1,
      },
      {
        name: "Überlebenskünstler",
        description: "Übung in Animal Handling, Medicine, Athletics oder Survival (eine wählen).",
        level: 1,
      },
    ],
  },
  {
    key: "fukuro",
    name: "Fukuro",
    nameEn: "Fukuro",
    hook: "Flug wie deine Bewegungsrate, Krallen und Wind Caller ab Stufe 5 — wenn die Rüstung leicht genug bleibt.",
    description:
      "Avian Humanoids mit Superior Darkvision (120 Fuß), Flug (gleich Gehgeschwindigkeit, nicht in schwerer Rüstung), " +
      "Talons (1W6 + Strength), Flyby-Disengage und Gust of Wind ab Stufe 5.\n\n" +
      "Flavour: Fernhandelswege Richtung Validori; stolze Wächter des Himmels, nicht Hafenstatistik.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 120,
    traits: [
      {
        name: "Krallen",
        description: "Krallen: 1W6 + Strength Slashing als unbewaffneter Schlag.",
        level: 1,
      },
      {
        name: "Flug",
        description:
          "Fluggeschwindigkeit = Gehgeschwindigkeit. Kein Flug in mittlerer oder schwerer Rüstung.",
        level: 1,
      },
      {
        name: "Flyby",
        description: "Bonusaktion: Disengage-Aktion.",
        level: 1,
      },
      {
        name: "Windrufer",
        description:
          "Ab Stufe 5: Gust of Wind über dieses Merkmal (Zauberattribut Intelligence, Wisdom oder Charisma — einmal wählen). Einmal pro langer Rast.",
        level: 5,
      },
    ],
  },
  {
    key: "felin",
    name: "Felin",
    nameEn: "Felin",
    hook: "Klettern wie laufen, Katzenreflexe für Doppeltempo — und zwei Fertigkeiten, die du wirklich brauchst.",
    description:
      "Felin haben Darkvision 60 Fuß, Klettergeschwindigkeit, Krallen (1W6 + Strength), Feline Agility (Doppelbewegung, einmal bis 0 Fuß) " +
      "und zwei Fertigkeiten aus Acrobatics, Survival, Perception oder Stealth.\n\n" +
      "Flavour: Ruinen und Relikte ziehen sie aus dem Arbor-Saum — Neugier schlägt Gold.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Katzenkrallen",
        description:
          "Klettergeschwindigkeit = Gehgeschwindigkeit. Krallen: 1W6 + Strength Slashing.",
        level: 1,
      },
      {
        name: "Katzenagilität",
        description:
          "Im Kampf: Bewegung in dem Zug verdoppeln. Einmal nutzbar, bis du in einem Zug 0 Fuß bewegst.",
        level: 1,
      },
      {
        name: "Katzeninstinkte",
        description: "Übung in zwei aus Acrobatics, Survival, Perception, Stealth.",
        level: 1,
      },
    ],
  },
  {
    key: "lepoling",
    name: "Lepoling",
    nameEn: "Lepoling",
    hook: "Initiative-Bonus, Glücksfuß auf Dexterity-Rettungen und Rabbit Hop — der Hase kommt zuerst.",
    description:
      "Hasenfolk mit Hare-Trigger (PB auf Initiative), Leporine Senses (Perception), Lucky Footwork (W4 auf gescheiterte Dex-Saves) " +
      "und Rabbit Hop (5 × PB Fuß, PB-mal pro lange Rast).\n\n" +
      "Flavour: Wyld-Hunt-Riten fern der Gilden — wer zurückkehrt, bekommt einen Namen.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Hasenreflex",
        description: "Du addierst deinen Übungsbonus auf Initiativewürfe.",
        level: 1,
      },
      {
        name: "Hasensinne",
        description: "Du bist in Perception geübt.",
        level: 1,
      },
      {
        name: "Glücksschritt",
        description:
          "Reaktion bei gescheitertem Dexterity-Rettungswurf: W4 addieren (nicht wenn prone oder Bewegung 0).",
        level: 1,
      },
      {
        name: "Hasensprung",
        description:
          "Bonusaktion: Sprung 5 × PB Fuß ohne Gelegenheitsangriffe (nur wenn Speed > 0). PB-mal pro langer Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "morgawr",
    name: "Morgawr",
    nameEn: "Morgawr",
    hook: "Amphibisch, kälteresistent und Meister des Meeres — Propheten der Tiefe mit schwarzem Blut.",
    description:
      "Aquatische Humanoids: Schwimmen 30 Fuß, Amphibious, Superior Darkvision 120 Fuß, Kälteresistenz, Black Blood (Würfel 1–2 auf Hit Dice rerollen), " +
      "Master of the Sea (Speak with Animals für Meerestiere; ab Stufe 3 Fog Cloud, ab Stufe 7 Wall of Water).\n\n" +
      "Flavour: Das Innere Meer kennt ihre Städte; Validori sieht nur die Oberfläche.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 120,
    traits: [
      {
        name: "Amphibisch",
        description: "Luft und Wasser atmen; Schwimmen 30 Fuß.",
        level: 1,
      },
      {
        name: "Bestie der Tiefe",
        description: "Resistenz gegen Cold damage.",
        level: 1,
      },
      {
        name: "Schwarzes Blut",
        description: "Würfelst du 1 oder 2 auf einem Hit Die, darfst du sofort neu würfeln.",
        level: 1,
      },
      {
        name: "Meister des Meeres",
        description:
          "Speak with Animals (nur Meerestiere) willkürlich. Ab Stufe 3 Fog Cloud, ab Stufe 7 Wall of Water — je einmal pro langer Rast (Intelligence, Wisdom oder Charisma).",
        level: 1,
      },
    ],
  },
  {
    key: "iso-tera",
    name: "Iso-Tera",
    nameEn: "Iso-Tera",
    hook: "Sechs Arme, Telepathie statt Sprechen und ein Panzer, der mit der Umgebung mitgeht.",
    description:
      "Insektoide Humanoids: Chameleon Carapace (AC 13 + Dexterity, Bonusaktion Tarnung), Darkvision 60 Fuß, Secondary Arms (leichte Waffen/Tiny-Objekte), Telepathy 120 Fuß.\n\n" +
      "Flavour: Nomadenpacks fern der Magisterstraßen — Clutch-Gefährten statt Stammbäume.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Chamäleonpanzer",
        description:
          "Ohne Rüstung AC 13 + Dexterity. Aktion: Panzerfarbe an Umgebung — Vorteil auf Stealth zum Verstecken dort.",
        level: 1,
      },
      {
        name: "Sekundäre Arme",
        description:
          "Zwei kleinere Armpaare: Tiny-Objekte, leichte Waffen, Türen — nicht schwere Manipulation.",
        level: 1,
      },
      {
        name: "Telepathie",
        description:
          "Gedanken an willige Kreaturen in 120 Fuß (mindestens eine Sprache beim Empfänger). Kein Sprechen fremder Sprachen ohne Magie.",
        level: 1,
      },
    ],
  },
  {
    key: "godling",
    name: "Godling",
    nameEn: "Godling",
    hook: "Celestial Resistance, Healing Hands und ab Stufe 3 eine Offenbarung — kein Aasimar im SRD, aber dieselbe Idee.",
    description:
      "Seltene celestial Flares in sterblichen Blutlinien: Necrotic/Radiant Resistance, Darkvision 60 Fuß, Healing Hands (PB × W4), Light cantrip, " +
      "Celestial Revelation ab Stufe 3 (Heavenly Wings / Inner Radiance / Necrotic Shroud).\n\n" +
      "Flavour: Validori nennt sie Wunderkinder; am Arbor-Saum eher Aberglaube als Willkommen.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Celestial Resistance",
        description: "Resistenz gegen Necrotic und Radiant damage.",
        level: 1,
      },
      {
        name: "Healing Hands",
        description:
          "Magische Aktion: PB × W4 Trefferpunkte heilen. Einmal pro langer Rast. Charisma ist Zauberattribut für Light.",
        level: 1,
      },
      {
        name: "Light Bearer",
        description: "Du kennst den Zaubertrick Light (Charisma).",
        level: 1,
      },
      {
        name: "Celestial Revelation",
        description:
          "Ab Stufe 3 Bonusaktion: 1 Minute Transformation (Heavenly Wings, Inner Radiance oder Necrotic Shroud). Extra Schaden = PB pro Zug. Einmal pro langer Rast.",
        level: 3,
      },
    ],
  },
  {
    key: "jotnar",
    name: "Jötnar",
    nameEn: "Jötnar",
    hook: "35 Fuß Tempo, Large Form ab Stufe 5 und ein Geistgeschenk deiner Wahl — Riesenblut ohne Goliath-Katalog.",
    description:
      "Sieben bis acht Fuß große Humanoids (Typ Giant): Powerful Build, 35 Fuß Speed, Large Form ab Stufe 5, Spirit Blessing (Wolf/Fox/Bear/Eagle/Raven/Leopard — PB Anwendungen).\n\n" +
      "Flavour: Nomaden nördlich des Arbor-Saums; Legenden schlagen Karawanenwege.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 35,
    darkvision: null,
    traits: [
      {
        name: "Kräftiger Körperbau",
        description: "Vorteil gegen Grappled beenden; Traglast eine Größenkategorie größer.",
        level: 1,
      },
      {
        name: "Große Gestalt",
        description:
          "Ab Stufe 5 Bonusaktion: Large für 10 Minuten — Vorteil Strength checks, +10 Fuß Speed. Einmal pro langer Rast.",
        level: 5,
      },
      {
        name: "Geistsegen",
        description:
          "Wähle Wolf, Fox, Bear, Eagle, Raven oder Leopard — PB Anwendungen pro lange Rast (Teleport, Extra-Schaden, Cold, Prone, Schadensreduktion W12+Constitution, Thunder).",
        level: 1,
      },
    ],
  },
  {
    key: "embeku",
    name: "Embeku",
    nameEn: "Embeku",
    hook: "Panzer AC 17, Shell Defence und Erinnerung in den Genen — du trägst dein Zuhause mit.",
    description:
      "Schildkrötenfolk: Krallen (1W6 + Strength), Hold Breath 1 Stunde, Natural Armour AC 17 (kein Dexterity), Shell Defence (+5 AC, Advantage Str/Con saves), Genetic Memory (zwei Fertigkeiten/Werkzeuge).\n\n" +
      "Flavour: Küsten am Inneren Meer; langlebig, selten, unbeeilt.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Krallen",
        description: "Krallen: 1W6 + Strength Slashing.",
        level: 1,
      },
      {
        name: "Atem anhalten",
        description: "Atem anhalten bis zu 1 Stunde.",
        level: 1,
      },
      {
        name: "Natürliche Rüstung",
        description: "AC 17 ohne Rüstung (Dexterity zählt nicht). Kein Nutzen aus getragener Rüstung; Schild erlaubt.",
        level: 1,
      },
      {
        name: "Panzerdeckung",
        description:
          "Aktion: Ziehst du dich in den Panzer zurück, bist du prone, deine Speed ist 0, du erhältst +5 AC sowie Advantage auf Strength- und Constitution-Rettungswürfe, " +
          "Nachteil auf Dexterity-Rettungswürfe, kannst keine Reaktionen ausführen, und Angriffe gegen dich haben keinen Vorteil, weil du prone bist. Bonusaktion, um wieder herauszukommen.",
        level: 1,
      },
      {
        name: "Genetische Erinnerung",
        description: "Übung in zwei Fertigkeiten oder Werkzeugen deiner Wahl.",
        level: 1,
      },
    ],
  },
  {
    key: "amphin",
    name: "Amphin",
    nameEn: "Amphin",
    hook: "Giftzunge, Frog Jump und Klettern an Wänden — klein, bunt, gefährlich.",
    description:
      "Froschfolk (Small): 25 Fuß Gehen/Schwimmen/Klettern (Wände/Decken, keine Hände frei), Amphibious, Poison Resistance, Frog Jump, Poisonous Tongue (Con-Save oder poisoned/incapacitated).\n\n" +
      "Flavour: Sümpfe und Precursor-Ruinen — kurze Leben, laute Quests.",
    source: OWNER_NOTES_SOURCE,
    size: "small",
    speed: 25,
    darkvision: null,
    traits: [
      {
        name: "Amphibisch",
        description: "Luft und Wasser; Klettern 25 Fuß an vertikalen Flächen ohne freie Hände.",
        level: 1,
      },
      {
        name: "Giftresistenz",
        description: "Resistenz gegen Poison damage; Vorteil gegen/bei Poisoned.",
        level: 1,
      },
      {
        name: "Froschsprung",
        description: "Bonusaktion: Sprung 5 × PB Fuß (Speed > 0). PB-mal pro langer Rast.",
        level: 1,
      },
      {
        name: "Giftzunge",
        description:
          "Bonusaktion 15 Fuß: Constitution-SG 8+PB+Constitution — Misserfolg poisoned + incapacitated, Speed 0 bis Zugbeginn. PB-mal pro langer Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "lamia",
    name: "Lamia",
    nameEn: "Lamia",
    hook: "Magieresistenz, Gift und serpentiner Zaubertrick — Tempelkulte fern Validoris, wo Schuppen mehr wiegen als Siegel.",
    description:
      "Schlangenfolk: Darkvision 60 Fuß, Advantage gegen Spells, Poison Resistance, Poison Spray + Charm Person (Stufe 3) + Suggestion (Stufe 5).\n\n" +
      "Flavour: Tempelkulte fern Validoris — Status in Schuppen, nicht in Siegeln.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Magieresistenz",
        description: "Vorteil auf Rettungswürfe gegen Zauber.",
        level: 1,
      },
      {
        name: "Giftresistenz",
        description: "Vorteil gegen Gift; Resistenz gegen Poison damage.",
        level: 1,
      },
      {
        name: "Serpentiner Zauber",
        description:
          "Poison Spray. Ab Stufe 3 Charm Person, ab Stufe 5 Suggestion — je einmal pro langer Rast (Intelligence, Wisdom oder Charisma).",
        level: 1,
      },
    ],
  },
];

/** Owner-Notizen-Völker (Phase 1 + Phase 2). */
export const SPECIES_EXTENDED: Species[] = [
  ...SPECIES_EXTENDED_PHASE1,
  ...SPECIES_EXTENDED_PHASE2,
];
