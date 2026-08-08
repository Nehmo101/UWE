/**
 * Owner-Notizen-Spezies — Import Phase 2.
 *
 * Ausgelagert aus `species-extended.ts` wegen Zeilenbudget.
 * Mechanik aus den Spezies-Extracts; Flavour für Terra umgeschrieben.
 */

import { OWNER_NOTES_SOURCE, type Species } from "../types";
import { KATHAI_LINEAGES } from "./species-extended-lineages";

/** Phase-2-Völker mit vollen Traits im Extract. */
export const SPECIES_EXTENDED_PHASE2: Species[] = [
  {
    key: "ifrit",
    name: "Ifrit",
    nameEn: "Ifrit",
    hook: "Feuerresistenz und Reach to the Blaze — Control Flame, Burning Hands, Flame Blade.",
    description:
      "Ifrits sind flammenberührte Humanoids: Darkvision 60 Fuß, Fire Resistance und Reach to the Blaze " +
      "(Control Flame; ab Stufe 3 Burning Hands, ab Stufe 5 Flame Blade).\n\n" +
      "Flavour: Inselketten und heiße Küsten am Inneren Meer — Wächter von Land, See und Himmel, " +
      "nicht Touristenattraktion in Validori.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Feuerresistenz",
        description: "Du hast Resistenz gegen Fire damage.",
        level: 1,
      },
      {
        name: "Reach to the Blaze",
        description:
          "Du kennst Control Flame. Ab Stufe 3 Burning Hands, ab Stufe 5 Flame Blade (ohne Materialkomponente) — " +
          "je einmal pro langer Rast über dieses Merkmal; auch mit passenden Spell Slots. " +
          "Zauberattribut: Intelligence, Wisdom oder Charisma (einmal wählen).",
        level: 1,
      },
    ],
  },
  {
    key: "kathai",
    name: "Kathai",
    nameEn: "Kathai",
    hook: "Klein, klug und college-geprägt — Vorteil auf Int-/Wis-/Cha-Rettungen plus ein College deiner Wahl.",
    description:
      "Kathai sind Small-Humanoids (25 Fuß, Darkvision 60 Fuß) mit Kathai Cunning und einem College " +
      "(Dynamics, Statics oder Synergetics).\n\n" +
      "Flavour: Unterirdische Werkstätten und schwimmende Laborbauten fern der Magisterstraßen — " +
      "Krewes lösen Probleme, bevor Validori sie bemerkt.",
    source: OWNER_NOTES_SOURCE,
    size: "small",
    speed: 25,
    darkvision: 60,
    lineageLabel: "Kathai-College",
    lineages: KATHAI_LINEAGES,
    traits: [
      {
        name: "Kathai Cunning",
        description:
          "Du hast Vorteil auf Intelligence-, Wisdom- und Charisma-Rettungswürfe.",
        level: 1,
      },
      {
        name: "Kathai College",
        description:
          "Du wählst ein College (Dynamics, Statics oder Synergetics). Merkmale und Zauber folgen der Wahl.",
        level: 1,
      },
    ],
  },
  {
    key: "ipotan",
    name: "Ipotan",
    nameEn: "Ipotan",
    hook: "Augen im Nacken, Psychic Resistance und Furchtzauber — Beute, die zuerst schlägt.",
    description:
      "Ipotans sind Monstrosities: Brave, Eyes in Back, Psychic Resistance und Ipotan Tactics " +
      "(Cause Fear ab Stufe 3, Fear ab Stufe 7).\n\n" +
      "Flavour: Versteckte Siedlungen am Arbor-Saum — Misstrauen als Überlebensstrategie, nicht als Mode.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Creature Type",
        description: "Du bist eine Monstrosity.",
        level: 1,
      },
      {
        name: "Mutig",
        description:
          "Du hast Vorteil auf Rettungswürfe, mit denen du den Zustand Frightened vermeidest oder beendest.",
        level: 1,
      },
      {
        name: "Eyes in Back",
        description:
          "Solange du bei Bewusstsein bist, kannst du nicht überrascht werden. Andere Kreaturen erhalten keinen Vorteil " +
          "auf Angriffswürfe gegen dich, weil du sie nicht siehst.",
        level: 1,
      },
      {
        name: "Psychic Resistance",
        description: "Du hast Resistenz gegen Psychic damage.",
        level: 1,
      },
      {
        name: "Ipotan Tactics",
        description:
          "Ab Stufe 3 Cause Fear einmal pro langer Rast; ab Stufe 7 Fear einmal pro langer Rast — ohne Komponenten. " +
          "Zauberattribut: Intelligence, Wisdom oder Charisma. Auch mit Spell Slots nutzbar.",
        level: 3,
      },
    ],
  },
  {
    key: "automaton",
    name: "Automaton",
    nameEn: "Automaton",
    hook: "Construct mit +1 AC, Giftresistenz und Sentry’s Rest — Seele in verlorener Legierung.",
    description:
      "Automatons sind Constructs (Medium oder Small): Construct Resilience, Integrated Protection (+1 AC), " +
      "Sentry’s Rest (Lange Rast in 6 Stunden), Specialized Design, Tireless; immun gegen magisches Altern.\n\n" +
      "Flavour: Precursor-Metall an den Rändern Validoris — Werkzeug in den Augen der Gilden, Person für dich.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Creature Type",
        description: "Du bist ein Construct. Immun gegen magische Alterungseffekte.",
        level: 1,
      },
      {
        name: "Construct Resilience",
        description:
          "Resistenz gegen Poison damage; Vorteil auf Rettungswürfe gegen/bei Poisoned.",
        level: 1,
      },
      {
        name: "Integrated Protection",
        description:
          "+1 AC. Getragene Rüstung kann dir nicht gegen deinen Willen abgenommen werden, solange du lebst.",
        level: 1,
      },
      {
        name: "Sentry’s Rest",
        description:
          "Du brauchst keinen Schlaf; Magie kann dich nicht einschläfern. Lange Rast in 6 Stunden inaktiv und regungslos " +
          "(bewusst, wirkt inert).",
        level: 1,
      },
      {
        name: "Specialized Design",
        description: "Übung in einer Fertigkeit und einem Werkzeug deiner Wahl.",
        level: 1,
      },
      {
        name: "Tireless",
        description:
          "Du erhältst keine Exhaustion-Stufen durch Dehydration, Mangelernährung oder Ersticken.",
        level: 1,
      },
    ],
  },
  {
    key: "lupull",
    name: "Lupull",
    nameEn: "Lupull",
    hook: "35 Fuß Tempo, Biss, Daunting Howl und zwei Canine-Fertigkeiten — Kriegerhund mit Eifer.",
    description:
      "Lupull sind canine Humanoids: Bite (1W6 + Strength Piercing), Keen Senses, Daunting Howl und Canine Instincts.\n\n" +
      "Flavour: Kriegerbünde zwischen Nepurga-Grenzland und Arbor-Saum — Zwilling und Eifer zählen mehr als Siegel.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 35,
    darkvision: null,
    traits: [
      {
        name: "Biss",
        description:
          "Dein Reißmaul ist ein unbewaffneter Schlag: 1W6 + Strength Piercing statt Bludgeoning.",
        level: 1,
      },
      {
        name: "Keen Senses",
        description:
          "Vorteil auf Wisdom (Perception)- und Wisdom (Survival)-Checks, die Gehör oder Geruch betreffen.",
        level: 1,
      },
      {
        name: "Daunting Howl",
        description:
          "Bonusaktion: Kreaturen deiner Wahl in 10 Fuß, die dich hören, Wisdom-SG 8 + PB + Constitution — " +
          "Misserfolg Frightened bis Ende deines nächsten Zugs. PB-mal pro langer Rast.",
        level: 1,
      },
      {
        name: "Canine Instincts",
        description: "Übung in zwei aus Survival, Perception, Intimidation, Stealth.",
        level: 1,
      },
    ],
  },
  {
    key: "ganeshi",
    name: "Ganeshi",
    nameEn: "Ganeshi",
    hook: "Powerful Build, Natural Armour (12 + Constitution) und ein Rüssel — Gedächtnis wie Panzer.",
    description:
      "Ganeshis sind elephantine Humanoids: Powerful Build, Ganeshi Serenity, Natural Armour (AC 12 + Constitution), " +
      "Trunk und Keen Smell.\n\n" +
      "Flavour: Clans mit strenger Rechtstradition — Loyalität innen, Absolutheit außen; fern der Gildenalleen Validoris.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Kräftiger Körperbau",
        description:
          "Vorteil auf Checks zum Beenden von Grappled; Traglast eine Größenkategorie größer.",
        level: 1,
      },
      {
        name: "Ganeshi Serenity",
        description: "Vorteil gegen Charmed und Frightened.",
        level: 1,
      },
      {
        name: "Natürliche Rüstung",
        description:
          "Basis-AC 12 + Constitution-Modifikator. Nutzbar, wenn getragene Rüstung niedriger wäre; Schild normal.",
        level: 1,
      },
      {
        name: "Trunk",
        description:
          "Rüssel 5 Fuß Reichweite; hebt bis 5 × Strength Pfund. Einfache Aufgaben (heben, öffnen, Grapple, " +
          "unarmed strike, Schnorchel). Keine Waffen/Schilde/Präzision/Somatik.",
        level: 1,
      },
      {
        name: "Keen Smell",
        description:
          "Vorteil auf Wisdom (Perception)-, Wisdom (Survival)- und Intelligence (Investigation)-Checks " +
          "mit Geruch oder Gehör.",
        level: 1,
      },
    ],
  },
  {
    key: "oodoon",
    name: "Oodoon",
    nameEn: "Oodoon",
    hook: "Amphibisch, Natural Armor 12 + Dexterity und Leviathan Will — rund, wachsam, standhaft.",
    description:
      "Oodoons: Schwimmen 30 Fuß, Luft und Wasser atmen, Darkvision 60 Fuß, Natural Armor (AC 12 + Dexterity), " +
      "Leviathan Will und Observant and Athletic.\n\n" +
      "Flavour: Korallen-Pods am Inneren Meer — gemeinschaftlich, vorsichtig gegenüber Schatten aus der Tiefe.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 60,
    traits: [
      {
        name: "Amphibisch",
        description: "Luft und Wasser atmen; Schwimmen 30 Fuß.",
        level: 1,
      },
      {
        name: "Natürliche Rüstung",
        description:
          "Ohne Rüstung AC 12 + Dexterity (oder getragene Rüstung, wenn höher). Schild normal.",
        level: 1,
      },
      {
        name: "Leviathan Will",
        description:
          "Vorteil auf Rettungswürfe gegen Charmed, Frightened, Paralyzed, Poisoned, Stunned oder Einschlafen.",
        level: 1,
      },
      {
        name: "Observant and Athletic",
        description: "Übung in Athletics oder Perception (eine wählen).",
        level: 1,
      },
    ],
  },
  {
    key: "mucosi",
    name: "Mucosi",
    nameEn: "Mucosi",
    hook: "Ooze mit Amorphous, Change Shape und Deception/Performance — Form ist Vorschlag, nicht Festung.",
    description:
      "Mucosi sind Oozes (Medium oder Small): Amorphous, Natural Resilience (Acid/Poison), Change Shape " +
      "und Delightful Imitator (Deception + Performance).\n\n" +
      "Flavour: Gelatine und Neugier auf den Handelswegen — Validori sieht ein Wunder, du siehst Stoff.",
    source: OWNER_NOTES_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: null,
    traits: [
      {
        name: "Creature Type",
        description: "Du bist ein Ooze.",
        level: 1,
      },
      {
        name: "Amorphous",
        description:
          "Wenn du nichts trägst und nichts bei dir führst: durch Spalten bis 1 Zoll. Vorteil auf Checks zum Einleiten oder Beenden eines Grapples.",
        level: 1,
      },
      {
        name: "Natural Resilience",
        description:
          "Resistenz gegen Acid und Poison damage; Vorteil gegen Poisoned.",
        level: 1,
      },
      {
        name: "Change Shape",
        description:
          "Aktion: zweibeinige Humanoid- oder vierbeinige Beast-Form (Humanoid: Kleidung/Rüstung deiner Größe). " +
          "Bonusaktion: Pseudopod bis 6 Zoll breit / 15 Fuß lang — Objekte, Türen, Tiny-Gegenstände (max. 10 Pfund); " +
          "kein Angriff, keine Magie-Items, keine Sinne.",
        level: 1,
      },
      {
        name: "Delightful Imitator",
        description: "Übung in Deception und Performance.",
        level: 1,
      },
    ],
  },
];
