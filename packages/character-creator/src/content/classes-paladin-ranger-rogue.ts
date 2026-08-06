/**
 * Klassenkatalog: Paladin, Waldläufer, Schurke.
 *
 * Quelle: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast), Regelstand 2024.
 * Die deutschen Klassennamen folgen bewusst der bereits etablierten UWE-Liste
 * `PICKABLE_CLASSES` in `packages/database/src/character-level-up-service.ts` —
 * inklusive der dortigen Eigenheiten. Wer hier umbenennt, bricht den Stufenaufstieg.
 *
 * Startausrüstung: SRD 2024 stellt pro Klasse „Wähle A oder B“ — A ist ein
 * Ausrüstungspaket mit etwas Restgold, B ist reines Gold. Deshalb steht A hier
 * als `EquipmentOption` und B in `startingGoldAlternative`; der Entwurf
 * (`CharacterDraft.equipmentChoice`) kennt für B den Wert `"gold"`.
 */

import type { DndClass } from "../types";
import { SRD_SOURCE } from "../types";

export const CLASSES_PALADIN_RANGER_ROGUE: DndClass[] = [
  // ───────────────────────────── Paladin ─────────────────────────────
  {
    key: "paladin",
    name: "Paladin",
    nameEn: "Paladin",
    hook: "Du stellst dich zwischen deine Gruppe und das, was sie umbringen will — in voller Rüstung, mit einem Eid, den du selbst gesprochen hast, und mit einer Hand, die Wunden schließt.",
    description:
      "Ein Paladin ist kein Priester, der zufällig ein Schwert trägt. Ein Paladin ist jemand, der ein Versprechen abgelegt hat und daraus Macht zieht — nicht aus der Gunst eines Gottes, sondern aus der eigenen Unbeirrbarkeit. Der Eid kommt zuerst, die Magie danach.\n\nAm Tisch bist du die Wand: schwerste Rüstung, Schild, die besten Rettungswürfe der Gruppe. Handauflegen ist ein Vorrat an Trefferpunkten, den du über den ganzen Tag verteilst — für andere oder für dich. Ab Stufe 2 kommt der Schmettern-Schlag dazu, mit dem du einen Zauberplatz in geballten Schaden verwandelst, wenn es darauf ankommt.\n\nDie Rolle ist dankbar für Einsteiger: Du hast wenige, dafür wuchtige Entscheidungen. Der eigentliche Reiz liegt außerhalb des Kampfes — ein Eid, den man halten muss, erzeugt am Spieltisch mehr Geschichten als jede Zauberliste.",
    source: SRD_SOURCE,
    hitDie: 10,
    primaryAbilities: ["strength", "charisma"],
    savingThrows: ["wisdom", "charisma"],
    skills: {
      choose: 2,
      from: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    },
    armorProficiencies: ["Leichte, mittlere und schwere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen", "Kriegswaffen"],
    toolProficiencies: [],
    spellcasting: {
      progression: "half",
      ability: "charisma",
      preparation: "prepared",
      // SRD 2024: Der Paladin zaubert bereits ab Stufe 1 (2014 erst ab Stufe 2)
      // und hat keine Zaubertricks.
      cantripsKnown: 0,
      spellsKnownAtFirst: 2,
      spellList: "paladin",
    },
    features: [
      {
        name: "Handauflegen",
        level: 1,
        description:
          "Du hast einen Vorrat an Heilkraft von fünf Trefferpunkten pro Paladinstufe, der sich mit einer langen Rast auffüllt. Als Bonusaktion berührst du eine Kreatur (auch dich selbst) und stellst daraus beliebig viele Trefferpunkte wieder her. Für 5 Punkte aus dem Vorrat entfernst du stattdessen den Zustand „Vergiftet“.",
      },
      {
        name: "Zauberwirken",
        level: 1,
        description:
          "Du wirkst Paladinzauber über Gebet und Meditation. Auf Stufe 1 bereitest du zwei Zauber des 1. Grades vor und hast zwei Zauberplätze des 1. Grades. Charisma ist dein Zauberattribut; ein heiliges Symbol dient als Zauberfokus. Nach jeder langen Rast darfst du einen vorbereiteten Zauber austauschen.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du nutzt die Meisterschaftseigenschaften von zwei Waffenarten deiner Wahl, mit denen du geübt bist — etwa Langschwert und Wurfspeer. Nach jeder langen Rast darfst du die Auswahl wechseln.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Heiliger Eid",
    subclasses: [
      {
        key: "eid_der_hingabe",
        name: "Eid der Hingabe",
        nameEn: "Oath of Devotion",
        hook: "Der Ritter in glänzender Rüstung — Wort halten, Schwache schützen, mit gutem Beispiel vorangehen.",
        description:
          "Dieser Eid bindet an Gerechtigkeit und Ordnung. Die Gelobten halten sich an die höchsten Maßstäbe — und manche halten auch den Rest der Welt daran. Die drei Gelübde lauten: Dein Wort sei dein Versprechen. Schütze die Schwachen und scheue niemals das Handeln. Deine ehrenhaften Taten seien ein Vorbild.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Zauber des Eids der Hingabe",
            level: 3,
            description:
              "Ab bestimmten Paladinstufen hast du feste Zauber dauerhaft vorbereitet; sie zählen nicht gegen dein Kontingent. Auf Stufe 3 sind das „Schutz vor Gut und Böse“ und „Schild des Glaubens“.",
          },
          {
            name: "Heilige Waffe",
            level: 3,
            description:
              "Wenn du die Angriffsaktion nimmst, kannst du eine Anwendung von Göttlicher Kanalisierung ausgeben und eine gehaltene Nahkampfwaffe aufladen. 10 Minuten lang addierst du deinen Charisma-Modifikator (mindestens +1) auf Angriffswürfe damit und darfst bei jedem Treffer statt des normalen Schadenstyps gleißenden Schaden verursachen. Die Waffe spendet helles Licht im Umkreis von 6 Metern.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Rüstung und Waffen",
        items: [
          { name: "Kettenrüstung", quantity: 1 },
          { name: "Schild", quantity: 1 },
          { name: "Langschwert", quantity: 1 },
          { name: "Wurfspeer", quantity: 6 },
          { name: "Heiliges Symbol", quantity: 1, notes: "Zauberfokus" },
          { name: "Priesterpaket", quantity: 1 },
        ],
        gold: 9,
      },
    ],
    startingGoldAlternative: 150,
    roleTags: ["Nahkampf", "Schutz", "Heilung", "Anführer"],
    complexity: 2,
    art: "/character-creator/classes/paladin.svg",
  },

  // ──────────────────────────── Waldläufer ────────────────────────────
  {
    key: "waldlaeufer",
    name: "Waldläufer",
    nameEn: "Ranger",
    hook: "Du findest die Spur, die niemand sonst sieht, markierst dein Ziel — und ab da hört das Ziel nicht mehr auf zu bluten, egal wie weit es läuft.",
    description:
      "Der Waldläufer lebt an der Grenze zwischen Zivilisation und Wildnis und ist dort zu Hause, wo andere sich verlaufen. Seine Magie ist keine Bibliotheksmagie, sondern die geliehene Essenz der Natur: ein paar gezielte Zauber, die einen Kampf kippen oder eine Reise überhaupt erst möglich machen.\n\nMechanisch ist „Bevorzugter Feind“ das Herzstück: Du hast „Jägermal“ immer vorbereitet und darfst es zweimal pro langer Rast ohne Zauberplatz wirken. Damit läuft praktisch jeder Kampf gleich an — Mal setzen, dann Schaden liefern, mit Bogen oder mit zwei Klingen.\n\nDrei Fertigkeiten sind die meisten unter allen Klassen. Wer gern der ist, der die Gruppe durch Sumpf, Nacht und fremdes Land bringt, bekommt hier eine Figur, die außerhalb des Kampfes genauso viel zu tun hat wie darin.",
    source: SRD_SOURCE,
    hitDie: 10,
    primaryAbilities: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skills: {
      choose: 3,
      from: [
        "animal_handling",
        "athletics",
        "insight",
        "investigation",
        "nature",
        "perception",
        "stealth",
        "survival",
      ],
    },
    armorProficiencies: ["Leichte und mittlere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen", "Kriegswaffen"],
    // SRD 5.2.1 nennt in den Kernmerkmalen des Waldläufers keine Werkzeuge.
    toolProficiencies: [],
    spellcasting: {
      progression: "half",
      ability: "wisdom",
      preparation: "prepared",
      // SRD 2024: Zauberwirken bereits ab Stufe 1 (2014 erst ab Stufe 2), keine Zaubertricks.
      cantripsKnown: 0,
      spellsKnownAtFirst: 2,
      spellList: "waldlaeufer",
    },
    features: [
      {
        name: "Zauberwirken",
        level: 1,
        description:
          "Du kanalisierst die magische Essenz der Natur. Auf Stufe 1 bereitest du zwei Zauber des 1. Grades vor und hast zwei Zauberplätze des 1. Grades. Weisheit ist dein Zauberattribut; ein druidischer Fokus dient als Zauberfokus. Nach jeder langen Rast darfst du einen vorbereiteten Zauber austauschen.",
      },
      {
        name: "Bevorzugter Feind",
        level: 1,
        description:
          "Du hast den Zauber „Jägermal“ immer vorbereitet und kannst ihn zweimal wirken, ohne einen Zauberplatz auszugeben. Verbrauchte Anwendungen kehren mit einer langen Rast zurück; ihre Zahl steigt mit deiner Stufe.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du nutzt die Meisterschaftseigenschaften von zwei Waffenarten deiner Wahl, mit denen du geübt bist — etwa Langbogen und Kurzschwert. Nach jeder langen Rast darfst du die Auswahl wechseln.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Archetyp",
    subclasses: [
      {
        key: "jaeger",
        name: "Jäger",
        nameEn: "Hunter",
        hook: "Du erlegst, was zu groß, zu viel oder zu gefährlich für alle anderen ist.",
        description:
          "Du pirschst dich an Beute an — in der Wildnis und anderswo — und setzt deine Fähigkeiten ein, um Natur und Menschen vor den Kräften zu schützen, die sie zerstören würden.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Wissen des Jägers",
            level: 3,
            description:
              "Solange eine Kreatur von deinem „Jägermal“ markiert ist, weißt du, ob sie Immunitäten, Resistenzen oder Verwundbarkeiten hat — und welche.",
          },
          {
            name: "Beute des Jägers",
            level: 3,
            description:
              "Du wählst eine von zwei Optionen und darfst nach jeder Rast wechseln. Kolossbezwinger: Trifft du eine Kreatur mit einer Waffe, die bereits Trefferpunkte verloren hat, verursachst du einmal pro Zug 1W8 zusätzlichen Schaden. Hordenbrecher: Einmal pro Zug greifst du mit derselben Waffe ein zweites Ziel an, das höchstens 1,5 Meter vom ersten entfernt ist.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Ausrüstung für die Wildnis",
        items: [
          { name: "Beschlagene Lederrüstung", quantity: 1 },
          { name: "Krummsäbel", quantity: 1 },
          { name: "Kurzschwert", quantity: 1 },
          { name: "Langbogen", quantity: 1 },
          { name: "Pfeile", quantity: 20 },
          { name: "Köcher", quantity: 1 },
          { name: "Druidischer Fokus", quantity: 1, notes: "Mistelzweig" },
          { name: "Entdeckerpaket", quantity: 1 },
        ],
        gold: 7,
      },
    ],
    startingGoldAlternative: 150,
    roleTags: ["Fernkampf", "Erkundung", "Spurensuche", "Naturmagie"],
    complexity: 2,
    art: "/character-creator/classes/waldlaeufer.svg",
  },

  // ───────────────────────────── Schurke ─────────────────────────────
  {
    key: "schurke",
    name: "Schurke",
    nameEn: "Rogue",
    hook: "Ein Treffer im richtigen Moment ist mehr wert als drei im falschen — und du bist der Einzige, der schon im Raum war, bevor der Kampf begann.",
    description:
      "Der Schurke gewinnt nicht durch Ausdauer, sondern durch Timing. Hinterhältiger Angriff verwandelt einen einzigen gelungenen Treffer pro Zug in den härtesten Schlag der Gruppe — Voraussetzung ist nur, dass du im Vorteil bist oder ein Verbündeter dem Ziel im Nacken sitzt. Das lässt sich fast immer einrichten, und genau darin liegt das Spiel.\n\nVier Fertigkeiten sind mehr als jede andere Klasse hat, dazu zwei davon mit Expertise, also doppeltem Übungsbonus. Am Spieltisch heißt das: Schlösser, Fallen, Taschen, Wachen, Gerüchte. Wenn die Gruppe irgendwo hineinkommen muss, ohne dass jemand schreit, bist du der Plan.\n\nWer keine Zauberliste lernen will, aber trotzdem jede Runde etwas Cleveres tun möchte, ist hier richtig. Zauber gibt es auf Stufe 1 keine — dafür ab Stufe 2 die Listige Aktion, die Rennen, Rückzug und Verstecken zur Bonusaktion macht.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["dexterity"],
    savingThrows: ["dexterity", "intelligence"],
    skills: {
      // SRD 5.2.1 führt „Auftreten“ bewusst nicht in der Schurkenliste.
      choose: 4,
      from: [
        "acrobatics",
        "athletics",
        "deception",
        "insight",
        "intimidation",
        "investigation",
        "perception",
        "persuasion",
        "sleight_of_hand",
        "stealth",
      ],
    },
    armorProficiencies: ["Leichte Rüstung"],
    weaponProficiencies: [
      "Einfache Waffen",
      "Kriegswaffen mit der Eigenschaft Finesse oder Leicht",
    ],
    toolProficiencies: ["Diebeswerkzeug"],
    spellcasting: null,
    features: [
      {
        name: "Expertise",
        level: 1,
        description:
          "Du erhältst Expertise in zwei deiner Fertigkeiten — dort zählt dein Übungsbonus doppelt. Fingerfertigkeit und Heimlichkeit bieten sich an. Auf Stufe 6 kommen zwei weitere hinzu.",
      },
      {
        name: "Hinterhältiger Angriff",
        level: 1,
        description:
          "Einmal pro Zug verursachst du 1W6 zusätzlichen Schaden bei einer Kreatur, die du mit einem Angriffswurf triffst — vorausgesetzt, du hast Vorteil auf den Wurf und greifst mit einer Finesse- oder Fernkampfwaffe an. Der Vorteil ist nicht nötig, wenn ein handlungsfähiger Verbündeter innerhalb von 1,5 Metern des Ziels steht und du keinen Nachteil hast. Der Schaden steigt mit deiner Stufe.",
      },
      {
        name: "Gaunersprache",
        level: 1,
        description:
          "Du beherrschst die Gaunersprache — den verdeckten Jargon aus Andeutungen, Zeichen und Symbolen — sowie eine weitere Sprache deiner Wahl.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du nutzt die Meisterschaftseigenschaften von zwei Waffenarten deiner Wahl, mit denen du geübt bist — etwa Dolch und Kurzbogen. Nach jeder langen Rast darfst du die Auswahl wechseln.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Schurkenarchetyp",
    subclasses: [
      {
        key: "dieb",
        name: "Dieb",
        nameEn: "Thief",
        hook: "Der klassische Abenteurer: Einbrecher, Schatzsucher und Kletterer in einer Person.",
        description:
          "Eine Mischung aus Einbrecher, Schatzjäger und Entdecker — der Inbegriff des Abenteurers. Neben mehr Beweglichkeit und Heimlichkeit erhältst du Fähigkeiten, die beim Erkunden von Ruinen und beim Umgang mit magischen Fundstücken helfen.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Flinke Hände",
            level: 3,
            description:
              "Als Bonusaktion machst du entweder eine Geschicklichkeitsprobe (Fingerfertigkeit) — Schloss knacken, Falle entschärfen, Tasche ziehen — oder du nutzt einen Gegenstand, auch einen magischen, der dafür eine Aktion verlangt.",
          },
          {
            name: "Fassadenkletterer",
            level: 3,
            description:
              "Kletterer: Du erhältst eine Klettergeschwindigkeit in Höhe deiner Bewegungsrate. Springer: Deine Sprungweite bemisst sich an deiner Geschicklichkeit statt an deiner Stärke.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Werkzeug und leichte Klingen",
        items: [
          { name: "Lederrüstung", quantity: 1 },
          { name: "Dolch", quantity: 2 },
          { name: "Kurzschwert", quantity: 1 },
          { name: "Kurzbogen", quantity: 1 },
          { name: "Pfeile", quantity: 20 },
          { name: "Köcher", quantity: 1 },
          { name: "Diebeswerkzeug", quantity: 1 },
          { name: "Einbrecherpaket", quantity: 1 },
        ],
        gold: 8,
      },
    ],
    startingGoldAlternative: 100,
    roleTags: ["Heimlichkeit", "Schadensspitzen", "Fertigkeiten", "Erkundung"],
    complexity: 2,
    art: "/character-creator/classes/schurke.svg",
  },
];
