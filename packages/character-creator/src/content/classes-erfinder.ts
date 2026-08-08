/**
 * Klasse Erfinder (Artificer) — Owner-Notizen-Import.
 *
 * Mechanik aus den Owner-Notizen; Flavour für Terra (Validori / Magister /
 * Gilden), ohne Eberron/Tegora. Level-1-Fokus für den Charakterersteller;
 * Unterklassen ab Stufe 3 mit Stufe-3-Merkmalen.
 */

import { OWNER_NOTES_SOURCE, type DndClass } from "../types";

export const CLASSES_ERFINDER: DndClass[] = [
  {
    key: "erfinder",
    name: "Erfinder",
    nameEn: "Artificer",
    hook: "Du entzifferst Magie wie eine Werkstattzeichnung — und baust daraus Elixiere, Rüstungen und Apparate, die andere für Wunder halten.",
    description:
      "Erfinder sehen Magie als System, das man entschlüsseln und in Gegenstände pressen kann. In Validori stehen sie zwischen Magister-Turm und Gildenwerkstatt: Alchemisten-Vorräte, Kalligraphen-Tinte oder Tinkerwerkzeug werden zum Fokus, mit dem sie Zauber wirken — für Außenstehende wirkt es wie Taschenspielerei mit Werkzeug.\n\nAuf Stufe 1 kommen Zaubern (Intelligence), Magisches Basteln und die erste Invention. Ab Stufe 3 wählst du eine Spezialisierung — Alchemie, Rüstung, Artillerie, Kampfschmiede, Schmiedekrieg oder Kartographie. Der Erfinder ist halb Zauberwirker, halb Handwerker: viele Optionen, dafür Verwaltung.",
    source: OWNER_NOTES_SOURCE,
    hitDie: 8,
    primaryAbilities: ["intelligence"],
    savingThrows: ["constitution", "intelligence"],
    skills: {
      choose: 2,
      from: [
        "arcana",
        "history",
        "investigation",
        "medicine",
        "nature",
        "sleight_of_hand",
      ],
    },
    armorProficiencies: ["Leichte Rüstung", "Mittelschwere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: ["Tinkerwerkzeug"],
    spellcasting: {
      progression: "half",
      ability: "intelligence",
      preparation: "prepared",
      cantripsKnown: 2,
      spellsKnownAtFirst: 2,
      spellList: "erfinder",
    },
    features: [
      {
        name: "Zaubern",
        level: 1,
        description:
          "Du wirkst Zauber der Erfinder-Liste über Werkzeuge: Diebeswerkzeug, Tinkerwerkzeug oder anderes Handwerkerwerkzeug, in dem du geübt bist, dient als Zauberfokus und macht den Zauber materialpflichtig. Intelligence ist dein Zauberattribut. Auf Stufe 1 kennst du zwei Zaubertricks (nach langer Rast austauschbar) und bereitest zwei Zauber des 1. Grades vor; du hast zwei Zauberplätze des 1. Grades. Empfohlen: Säurespritzer und Zaubertrick sowie Wunden heilen und Schmierfett. Nach langer Rast darfst du einen vorbereiteten Zauber austauschen.",
      },
      {
        name: "Magisches Basteln",
        level: 1,
        description:
          "Du kennst den Zaubertrick Ausbessern. Mit Tinkerwerkzeug kannst du Identifizieren als Ritual wirken (Werkzeug ersetzt Material). Als Magieaktion mit Tinkerwerkzeug erschaffst du in einem freien Raum in 1,5 m eines der folgenden Gegenstände, der bis zur nächsten langen Rast besteht: Kugelset, Korb, Schlafsack, Glocke, Decke, Flaschenzug, Glasflasche, Eimer, Krähenfüße, Kerze, Brechstange, Flasche, Enterhaken, Jagdfalle, Krug, Lampe, Handschellen, Netz, Öl, Papier, Pergament, Stange, Beutel, Seil, Sack, Schaufel, Eisenstacheln, Schnur, Zunderbüchse, Fackel, Phiole. Anwendungen: Intelligence-Modifikator (mindestens 1), alle nach langer Rast.",
      },
      {
        name: "Invention",
        level: 1,
        description:
          "Du lernst eine Invention deiner Wahl aus der Inventionen-Liste dieser Klasse: magische Prototypen, mit denen du Alltagsgegenstände — Waffen, Rüstung, Werkzeuge oder Schmuck — dauerhaft mit deiner Signaturmagie auflädst. Während einer langen Rast kannst du eine Stunde mit Tinkerwerkzeug eine bekannte Invention gegen eine andere austauschen. Nach langer Rast berührst du mit Tinkerwerkzeug ein nichtmagisches Objekt und versiehst es mit einer deiner Inventionen. Jede Invention nur in einem Objekt, jedes Objekt nur eine Invention. SG für Rettungswürfe: 8 + Übungsbonus + Intelligence-Modifikator. Du kannst außerdem Common-Magiegegenstände studieren und als Invention nachbilden (höhere Seltenheiten später).",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Spezialisierung",
    subclasses: [
      {
        key: "alchimist",
        name: "Alchimist",
        nameEn: "Alchemist",
        hook: "Zwei Experimentelixiere nach jeder langen Rast — Heilung, Tempo oder Säure, je nach Würfelglück.",
        description:
          "Alchimisten mischen Reagenzien zu mystischen Wirkungen. In Validori gilt die Tradition als älteste Erfinder-Linie: vielseitig in Krieg und Frieden, nah an Gildenlabor und Magister-Apotheke.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Werkzeugübung",
            level: 3,
            description:
              "Übung mit Alchemistenausrüstung und Kräuterkundeset (sonst andere Handwerkerwerkzeuge). Gebräuchliche Tränke brauchen nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Alchimistenzauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Säurespritzer, Heilendes Wort, Strahl der Übelkeit (weitere auf höheren Stufen laut Tabelle).",
          },
          {
            name: "Experimentelixier",
            level: 3,
            description:
              "Nach langer Rast mit Alchemistenausrüstung zwei Elixiere (W6-Tabelle: Heilung, Schnelligkeit, Widerstandskraft, Kühnheit, Flug, Aqua Regia). Bonusaktion trinken oder verabreichen. Zusätzliche Elixiere: Magieaktion und zwei Ingenuity Points (Effekt wählbar).",
          },
          {
            name: "Homunkulus",
            level: 3,
            description:
              "Du erhältst einen Homunkulus-Diener; die maximale Zahl gleichzeitig infundierter Gegenstände steigt um 1, gebunden an diese Infusion.",
          },
        ],
      },
      {
        key: "ruestungsschmied",
        name: "Rüstungsschmied",
        nameEn: "Armorer",
        hook: "Deine Rüstung wird zur zweiten Haut — Kraftwaffe, Blitzwerfer oder Donnerschlag, je nach Modell.",
        description:
          "Rüstungsschmiede bauen Panzer zu magischen Gehäusen um. In den Werkstätten Validoris und an Nepurgas Garnisonen gelten sie als Frontlinien-Erfinder: Verteidigung und Angriff aus einem Stück Stahl.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Handwerkszeug",
            level: 3,
            description:
              "Ausbildung an schwerer Rüstung; Übung mit Schmiedewerkzeug. Rüstungshandwerk braucht nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Rüstungsschmied-Zauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Schild, Donnerwoge (weitere auf höheren Stufen).",
          },
          {
            name: "Arkane Rüstung",
            level: 3,
            description:
              "Als Magieaktion mit Schmiedewerkzeug wird getragene Rüstung zur Arkanen Rüstung: kein Strength-Minimum für dich, An-/Ablegen als Nutzen-Aktion, nicht gegen deinen Willen entfernbar, Zauberfokus. Zweite Haut bedeckt den Körper; Helm ein-/ausfahrbar als Bonusaktion.",
          },
          {
            name: "Rüstungsmodell",
            level: 3,
            description:
              "Wähle Dreadnaught (Force-Demolisher 1W10 Force, Reach, Topple; Riesenwuchs), Guardian (Thunder Pulse 1W8 Thunder, Defensives Feld) oder Infiltrator (Lightning Launcher 1W6 Lightning, +1,5 m Tempo, Vorteil auf Stealth). Angriffe mit der Spezialwaffe nutzen Intelligence. Modell nach kurzer/langer Rast änderbar.",
          },
        ],
      },
      {
        key: "artillerist",
        name: "Artillerist",
        nameEn: "Artillerist",
        hook: "Ein arkanes Feuerrohr in der Hand — Balliste, Flammenwerfer oder Schutzstoß als Bonusaktion.",
        description:
          "Artilleristen schleudern Energie und Explosionen. Nach Feldzügen um Validori und den Handelswegen Nepurgas suchen viele den Frieden — indem sie Streit wieder löschen, bevor er eskaliert.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Werkzeugübung",
            level: 3,
            description:
              "Übung mit kriegerischen Fernkampfwaffen und Holzschnitzerwerkzeug. Zauberstäbe brauchen nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Artilleristen-Zauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Magisches Geschoss, Donnerwoge (weitere auf höheren Stufen).",
          },
          {
            name: "Arkanes Feuerrohr",
            level: 3,
            description:
              "Als Magieaktion mit Holzschnitzer- oder Schmiedewerkzeug erschaffst du ein einhändiges Arkanes Feuerrohr (Zauberfokus). Bonusaktion: Force-Balliste (2W8 Force, Schub 1,5 m), Flammenwerfer (3 m Kegel, 2W8 Fire) oder Beschützer (1W8 + Intelligence temp. TP in 3 m). Ein Rohr gleichzeitig; neu nach kurzer/langer Rast oder zwei Ingenuity Points.",
          },
        ],
      },
      {
        key: "kampfschmied",
        name: "Kampfschmied",
        nameEn: "Battle Smith",
        hook: "An deiner Seite läuft ein Stahlverteidiger — Heilung, Schutz und Force-Klauen in einem Apparat.",
        description:
          "Kampfschmiede sind Beschützer und Feldmediziner. Ihr Stahlverteidiger ist Werkstattarbeit aus Validori: humanoid mit Schild oder als Reittier-Vierbeiner — gebaut, um Verbündete zu halten und Material zu flicken.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Werkzeugübung",
            level: 3,
            description:
              "Übung mit Schmiedewerkzeug. Waffenhandwerk braucht nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Kampfschmied-Zauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Schild des Glaubens, Schild (weitere auf höheren Stufen).",
          },
          {
            name: "Stahlverteidiger",
            level: 3,
            description:
              "Konstrukt-Gefährte (AC 12+PB, TP 10+5×Erfinderstufe, Tempo 9 m). Teilt Initiative; handelt in deinem Zug; ohne Befehl ausweichen. Bonusaktion befehlen. Modular: Humanoid (Schilde, Hände) oder Vierbeiner (+3 m Tempo, Reittier). Ausbessern heilt 2W6; Wiederbelebung mit zwei Ingenuity Points möglich.",
          },
        ],
      },
      {
        key: "schmiedekrieger",
        name: "Schmiedekrieger",
        nameEn: "Forgewright",
        hook: "Eine Nahkampfwaffe wird zur Arkanen Rüstungswaffe — kritische Treffer schon bei 19, zurückkehrend geworfen.",
        description:
          "Schmiedekrieger suchen den Kampf um des Kampfes willen. In den Gildenhallen Validoris und an Nepurgas Fronten schmieden sie aus Innovation und Stahl ihre Signaturwaffe.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Werkzeugübung",
            level: 3,
            description:
              "Übung mit Schmiedewerkzeug. Waffenhandwerk braucht nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Schmiedekrieger-Zauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Compelled Duel, Zephyr Strike (weitere auf höheren Stufen; nicht im Ersteller-Katalog Stufe 1).",
          },
          {
            name: "Arkane Rüstungswaffe",
            level: 3,
            description:
              "Während langer Rast formst du in 1 Stunde mit Schmiedewerkzeug eine gehaltene Nahkampfwaffe zur Arkanen Rüstungswaffe (nur eine). Kritisch bei 19–20; kann eine Infusion tragen (+1 Invention gebunden); magisch; Thrown 6/18 m und kehrt zurück; Zauberfokus.",
          },
        ],
      },
      {
        key: "kartograph",
        name: "Kartograph",
        nameEn: "Cartographer",
        hook: "Magische Karten verbinden die Gruppe — Initiative-Bonus, Sichtlinien durch die Karte, kurze Teleports.",
        description:
          "Kartographen sind Späher und Navigatoren der Gilden. Zwischen Arbor-Saum und Validoris Innerem Meer halten ihre Atlanten Verbündete auf Kurs und markieren Gefahren wie Tinte auf Pergament.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Handwerkszeug",
            level: 3,
            description:
              "Übung mit Kalligraphenausrüstung und Kartographenwerkzeug. Karten brauchen nur die Hälfte Zeit und Gold.",
          },
          {
            name: "Kartographen-Zauber",
            level: 3,
            description:
              "Immer vorbereitet ab Stufe 3: Feenfeuer, Führender Lichtstrahl, Heilendes Wort (weitere auf höheren Stufen).",
          },
          {
            name: "Abenteurer-Atlas",
            level: 3,
            description:
              "Nach langer Rast mit Kartographenwerkzeug: magische Karten für 1 + Intelligence-Modifikator Ziele (mindestens zwei). Träger: +1W4 Initiative, kennen Position anderer Kartenhalter auf derselben Ebene, können einander ohne Sicht als Zauberziel wählen solange in Reichweite.",
          },
          {
            name: "Kartenmagie",
            level: 3,
            description:
              "Ein Ingenuity Point: Feenfeuer als Bonusaktion ohne Zauberplatz. Portal-Sprung: Bewegung gleich der Hälfte deines Tempos, Teleport in 3 m Sicht oder in 1,5 m eines Kartenhalters in 9 m.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Nietlederrüstung, Armbrust und Tinkerwerkzeug",
        gold: 0,
        items: [
          { name: "Einfache Waffe deiner Wahl", quantity: 1 },
          { name: "Leichte Armbrust", quantity: 1 },
          { name: "Bolzen", quantity: 20 },
          { name: "Nietlederrüstung", quantity: 1 },
          { name: "Tinkerwerkzeug", quantity: 1 },
          { name: "Höhlenforscherpaket", quantity: 1 },
        ],
      },
      {
        key: "b",
        label: "B — Schuppenpanzer, Armbrust und Tinkerwerkzeug",
        gold: 0,
        items: [
          { name: "Einfache Waffe deiner Wahl", quantity: 1 },
          { name: "Leichte Armbrust", quantity: 1 },
          { name: "Bolzen", quantity: 20 },
          { name: "Schuppenpanzer", quantity: 1 },
          { name: "Tinkerwerkzeug", quantity: 1 },
          { name: "Höhlenforscherpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: null,
    roleTags: ["Unterstützung", "Kontrolle", "Handwerk", "Halbzauberer", "Vielseitig"],
    complexity: 3,
  },
];
