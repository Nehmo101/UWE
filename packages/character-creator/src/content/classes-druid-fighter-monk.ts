/**
 * Klassenkatalog, Teil 2: Druide, Kämpfer, Mönch.
 *
 * Inhalt aus dem SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast) — den Regeln von
 * 2024. Deutsche Namen und Prosa, `nameEn` hält das englische Original fest.
 *
 * Gleiche Konventionen wie in `classes-barbarian-bard-cleric.ts`:
 * - `spellcasting.spellList` trägt denselben Schlüssel wie die Klasse.
 * - `startingEquipment` listet nur die Sach-Optionen; die reine Goldvariante
 *   steht in `startingGoldAlternative` (`equipmentChoice === "gold"`).
 * - `roleTags` und `complexity` sind UWEs Einschätzung, nicht SRD-Inhalt.
 */

import { SRD_SOURCE, type DndClass } from "../types";

export const CLASSES_DRUID_FIGHTER_MONK: DndClass[] = [
  {
    key: "druide",
    name: "Druide",
    nameEn: "Druid",
    hook: "Du sprichst mit dem Raben auf dem Zaun, ziehst Dornen aus dem Boden und trägst ab der zweiten Stufe selbst ein Fell, wenn es damit schneller geht.",
    description:
      "Der Druide zieht seine Magie aus der Natur selbst. Er kennt Druidisch, die Geheimsprache seines Standes, hat den Zauber Mit Tieren sprechen dauerhaft parat und formt mit seinen Zaubern Wetter, Pflanzen und Tiere. Ab Stufe 2 nimmt er über Wildgestalt selbst Tiergestalt an.\n\nDas ist die vielseitigste und damit auch die anspruchsvollste Klasse dieser Auswahl: volle Zauberliste, die nach jeder langen Rast neu zusammengestellt wird, dazu ab Stufe 2 ein zweiter Satz Regeln für die Tierform. Wer gerne die Lösung sucht statt den Schlag, ist hier richtig — wer schnell loslegen will, eher nicht. Die Urtümliche Ordnung entscheidet auf Stufe 1, ob der Druide zum Zauberwirker (Magier) oder zur Kampfhilfe (Wächter) tendiert.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["wisdom"],
    savingThrows: ["intelligence", "wisdom"],
    skills: {
      choose: 2,
      from: [
        "animal_handling",
        "arcana",
        "insight",
        "medicine",
        "nature",
        "perception",
        "religion",
        "survival",
      ],
    },
    armorProficiencies: ["Leichte Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: ["Kräuterkundeset"],
    spellcasting: {
      progression: "full",
      ability: "wisdom",
      preparation: "prepared",
      cantripsKnown: 2,
      spellsKnownAtFirst: 4,
      spellList: "druide",
    },
    features: [
      {
        name: "Zaubern",
        level: 1,
        description:
          "Du wirkst Zauber aus der Druidenliste mit Weisheit als Zauberattribut; ein druidischer Fokus dient als Zauberfokus. Auf Stufe 1 kennst du zwei Zaubertricks und bereitest vier Zauber des 1. Grades vor. Nach jeder langen Rast darfst du die vorbereitete Liste vollständig neu zusammenstellen.",
      },
      {
        name: "Druidisch",
        level: 1,
        description:
          "Du beherrschst Druidisch, die Geheimsprache der Druiden, und hast den Zauber Mit Tieren sprechen dauerhaft vorbereitet. In Druidisch hinterlassene Botschaften erkennt jeder Kundige sofort; alle anderen bemerken sie erst mit einer Intelligenzprobe auf Nachforschen gegen SG 15 und können sie ohne Magie trotzdem nicht entziffern.",
      },
      {
        name: "Urtümliche Ordnung",
        level: 1,
        description:
          "Du wählst eine Rolle. Magier: ein zusätzlicher Zaubertrick von der Druidenliste und ein Bonus in Höhe deines Weisheitsmodifikators (mindestens +1) auf Intelligenzproben für Arkane Kunde und Naturkunde. Wächter: Übung mit Kriegswaffen und Ausbildung an mittelschwerer Rüstung.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Zirkel",
    subclasses: [
      {
        key: "zirkel-des-landes",
        name: "Zirkel des Landes",
        nameEn: "Circle of the Land",
        hook: "Deine Zauberliste ändert sich mit der Landschaft — Wüste, Eis, gemäßigte Zone oder Tropen, jeden Morgen neu wählbar.",
        description:
          "Der Zirkel des Landes vereint Mystiker und Gelehrte, die altes Wissen und alte Riten bewahren. Sie treffen sich in heiligen Baumkreisen oder zwischen Steinsäulen und flüstern dort ihre Geheimnisse auf Druidisch. Die weisesten unter ihnen sind zugleich die Oberpriester ihrer Gemeinden.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Zauber des Zirkels des Landes",
            level: 3,
            description:
              "Nach jeder langen Rast wählst du eine Landschaftsart — dürr, polar, gemäßigt oder tropisch — und hast die zu deiner Druidenstufe passenden Zauber dieser Liste vorbereitet. Sie zählen nicht gegen die Zahl deiner vorbereiteten Zauber.",
          },
          {
            name: "Beistand des Landes",
            level: 3,
            description:
              "Als Magieaktion und Anwendung von Wildgestalt lässt du an einem Punkt in 18 Metern für einen Moment Blüten und Dornen aufbrechen — eine Kugel mit 3 Metern Radius. Jede Kreatur deiner Wahl darin muss einen Konstitutions-Rettungswurf gegen deinen Zauberrettungswurf-SG bestehen oder nimmt 2W6 nekrotischen Schaden, bei Erfolg die Hälfte. Eine Kreatur deiner Wahl im Bereich erhält 2W6 Trefferpunkte zurück. Schaden und Heilung steigen auf Stufe 10 und 14 um je 1W6.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Lederrüstung, Schild und druidischer Fokus",
        gold: 9,
        items: [
          { name: "Lederrüstung", quantity: 1 },
          { name: "Schild", quantity: 1 },
          { name: "Sichel", quantity: 1 },
          { name: "Druidischer Fokus (Kampfstab)", quantity: 1 },
          { name: "Entdeckerpaket", quantity: 1 },
          { name: "Kräuterkundeset", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 50,
    roleTags: [
      "Kontrolle",
      "Heilung",
      "Verwandlung",
      "Vielseitig",
      "Naturmagie",
    ],
    complexity: 3,
    art: "/character-creator/classes/druide.svg",
  },

  {
    key: "kaempfer",
    name: "Kämpfer",
    nameEn: "Fighter",
    hook: "Kein Zauber, kein Trick — nur die Gewissheit, dass du jede Waffe im Raum beherrschst, länger stehst als alle anderen und dir mitten im Gefecht selbst wieder auf die Beine hilfst.",
    description:
      "Der Kämpfer ist der Fachmann für Waffen und Rüstung, ohne Ausnahme: leichte, mittelschwere und schwere Rüstung, Schilde, einfache und kriegerische Waffen. Auf Stufe 1 wählt er einen Kampfstil, beherrscht die Meisterschaftseigenschaften von gleich drei Waffenarten und kann sich zweimal pro Rast-Zyklus mit Zweiter Atem selbst heilen.\n\nDamit ist er die zugänglichste Klasse überhaupt: In jeder Runde ist klar, was zu tun ist, und trotzdem wächst er später zu dem Charakter mit den meisten Angriffen im Spiel heran. Wer zum ersten Mal am Tisch sitzt, macht mit dem Kämpfer nichts falsch.",
    source: SRD_SOURCE,
    hitDie: 10,
    primaryAbilities: ["strength", "dexterity"],
    savingThrows: ["strength", "constitution"],
    skills: {
      choose: 2,
      from: [
        "acrobatics",
        "animal_handling",
        "athletics",
        "history",
        "insight",
        "intimidation",
        "perception",
        "persuasion",
        "survival",
      ],
    },
    armorProficiencies: [
      "Leichte Rüstung",
      "Mittelschwere Rüstung",
      "Schwere Rüstung",
      "Schilde",
    ],
    weaponProficiencies: ["Einfache Waffen", "Kriegswaffen"],
    toolProficiencies: [],
    spellcasting: null,
    features: [
      {
        name: "Kampfstil",
        level: 1,
        description:
          "Du erhältst ein Kampfstil-Talent deiner Wahl (Verteidigung ist die sichere Wahl für Anfänger). Bei jedem Stufenaufstieg als Kämpfer darfst du es gegen ein anderes Kampfstil-Talent tauschen.",
      },
      {
        name: "Zweiter Atem",
        level: 1,
        description:
          "Als Bonusaktion erhältst du 1W10 + deine Kämpferstufe an Trefferpunkten zurück. Zwei Anwendungen: eine kehrt nach einer kurzen Rast zurück, alle nach einer langen.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du beherrschst die Meisterschaftseigenschaften von drei Arten einfacher oder kriegerischer Waffen deiner Wahl — mehr als jede andere Klasse auf Stufe 1. Nach jeder langen Rast darfst du eine dieser Wahlen austauschen.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Archetyp",
    subclasses: [
      {
        key: "champion",
        name: "Champion",
        nameEn: "Champion",
        hook: "Kritische Treffer schon bei 19, Vorteil auf Initiative — der Archetyp, der nichts verwaltet und einfach härter zuschlägt.",
        description:
          "Der Champion setzt alles auf körperliche Höchstleistung im unerbittlichen Streben nach dem Sieg. Hartes Training und körperliche Vollkommenheit machen ihn zu jemandem, der verheerende Schläge austeilt, Gefahr aushält und Ruhm einsammelt — im Wettkampf wie in der Schlacht.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Verbesserter kritischer Treffer",
            level: 3,
            description:
              "Deine Angriffswürfe mit Waffen und waffenlosen Schlägen erzielen bereits bei einer 19 oder 20 auf dem W20 einen kritischen Treffer.",
          },
          {
            name: "Bemerkenswerter Athlet",
            level: 3,
            description:
              "Du hast Vorteil auf Initiativewürfe und auf Stärkeproben für Athletik. Direkt nach einem kritischen Treffer darfst du dich außerdem bis zur Hälfte deiner Bewegungsrate bewegen, ohne Gelegenheitsangriffe zu provozieren.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Kettenpanzer und Großschwert",
        gold: 4,
        items: [
          { name: "Kettenpanzer", quantity: 1 },
          { name: "Großschwert", quantity: 1 },
          { name: "Flegel", quantity: 1 },
          { name: "Wurfspeer", quantity: 8 },
          { name: "Höhlenforscherpaket", quantity: 1 },
        ],
      },
      {
        key: "b",
        label: "B — Nietlederrüstung und Langbogen",
        gold: 11,
        items: [
          { name: "Nietlederrüstung", quantity: 1 },
          { name: "Krummsäbel", quantity: 1 },
          { name: "Kurzschwert", quantity: 1 },
          { name: "Langbogen", quantity: 1 },
          { name: "Pfeile", quantity: 20 },
          { name: "Köcher", quantity: 1 },
          { name: "Höhlenforscherpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 155,
    roleTags: ["Nahkampf", "Schadensbringer", "Frontlinie", "Fernkampf"],
    complexity: 1,
    art: "/character-creator/classes/kaempfer.svg",
  },

  {
    key: "moench",
    name: "Mönch",
    nameEn: "Monk",
    hook: "Keine Rüstung, keine Waffe, kein Umweg: Du bist über die Mauer, hinter dem Bogenschützen und wieder weg, bevor der Kämpfer seinen ersten Schritt getan hat.",
    description:
      "Der Mönch kämpft mit bloßen Händen und leichten Waffen und verlässt sich auf Geschicklichkeit und Weisheit statt auf Stahl: Ohne Rüstung und ohne Schild ist seine Rüstungsklasse 10 + Geschicklichkeit + Weisheit. Kampfkunst gibt ihm schon auf Stufe 1 einen zusätzlichen waffenlosen Schlag als Bonusaktion und einen eigenen Schadenswürfel.\n\nAb Stufe 2 kommen Fokuspunkte dazu — Schlaghagel, Geduldige Verteidigung, Schritt des Windes —, aus denen sich die eigentliche Spielweise ergibt: viele kleine Treffer, extreme Beweglichkeit, wenig Puffer. Der Mönch verlangt zwei gute Attribute statt einem und Zurückhaltung beim Vorpreschen; dafür erreicht er Ziele, an die sonst niemand herankommt.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skills: {
      choose: 2,
      from: [
        "acrobatics",
        "athletics",
        "history",
        "insight",
        "religion",
        "stealth",
      ],
    },
    armorProficiencies: [],
    weaponProficiencies: [
      "Einfache Waffen",
      "Kriegswaffen mit der Eigenschaft „Leicht“",
    ],
    toolProficiencies: ["Ein Handwerkszeug oder Musikinstrument deiner Wahl"],
    spellcasting: null,
    features: [
      {
        name: "Kampfkunst",
        level: 1,
        description:
          "Solange du unbewaffnet bist oder nur Mönchswaffen (einfache Nahkampfwaffen sowie kriegerische Nahkampfwaffen mit der Eigenschaft „Leicht“) führst und weder Rüstung noch Schild trägst: Du darfst als Bonusaktion einen waffenlosen Schlag ausführen, statt des normalen Schadens 1W6 würfeln und für Angriffs- und Schadenswürfe sowie für Festhalten und Stoßen Geschicklichkeit statt Stärke verwenden.",
      },
      {
        name: "Ungepanzerte Verteidigung",
        level: 1,
        description:
          "Ohne Rüstung und ohne Schild ist deine Grundrüstungsklasse 10 + Geschicklichkeits- + Weisheitsmodifikator.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Kloster-Tradition",
    subclasses: [
      {
        key: "krieger-der-offenen-hand",
        name: "Krieger der Offenen Hand",
        nameEn: "Warrior of the Open Hand",
        hook: "Jeder Treffer aus dem Schlaghagel schiebt, wirft oder blockiert — du kontrollierst, wo der Gegner steht und was er noch tun darf.",
        description:
          "Krieger der Offenen Hand sind Meister des waffenlosen Kampfes. Sie lernen Techniken, um Gegner zu stoßen und zu Fall zu bringen, und lenken die eigene Energie so, dass sie sich damit vor Schaden schützen.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Technik der Offenen Hand",
            level: 3,
            description:
              "Triffst du eine Kreatur mit einem Angriff aus dem Schlaghagel, darfst du einen dieser Effekte auslösen. Verwirren: Das Ziel kann bis zum Beginn seines nächsten Zuges keine Gelegenheitsangriffe machen. Stoßen: Das Ziel muss einen Stärke-Rettungswurf bestehen oder wird bis zu 4,5 Meter von dir weggestoßen. Umwerfen: Das Ziel muss einen Geschicklichkeits-Rettungswurf bestehen oder liegt.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Speer, Dolche und Werkzeug",
        gold: 11,
        items: [
          { name: "Speer", quantity: 1 },
          { name: "Dolch", quantity: 5 },
          {
            name: "Handwerkszeug oder Musikinstrument",
            quantity: 1,
            notes: "Dasselbe, für das du oben die Übung gewählt hast.",
          },
          { name: "Entdeckerpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 50,
    roleTags: ["Nahkampf", "Beweglichkeit", "Kontrolle", "Kundschafter"],
    complexity: 2,
    art: "/character-creator/classes/moench.svg",
  },
];
