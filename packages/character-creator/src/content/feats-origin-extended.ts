/**
 * Herkunftstalente aus den Owner-Notizen — Ergänzung zum SRD-Bestand in
 * `feats.ts`. Mechanik aus
 * `tmp/character-creator-source-extract/Feats__Feats - Notizen.pdf.txt`;
 * Lore ohne Tegora/Kanka. Attributsnamen in Benefit-Texten bewusst Englisch
 * (Strength, Dexterity, …).
 */

import { OWNER_NOTES_SOURCE, type Feat } from "../types";

/**
 * Die sieben Ursprungstalente, die PHB-Hintergründe brauchen und die das
 * SRD 5.2.1 nicht liefert: Handwerker, Kampfeinweihung, Heiler, Glückspilz,
 * Musiker, Wirtshausraufbold, Zäh.
 */
export const ORIGIN_FEATS_EXTENDED: Feat[] = [
  {
    key: "handwerker",
    name: "Handwerker",
    nameEn: "Crafter",
    hook: "Drei Werkzeuge, Rabatt am Marktstand — und nach jeder langen Rast ein selbst gebautes Stück Ausrüstung.",
    description:
      "Du kennst dich mit Handwerk aus: Übung in drei Handwerkszeugen, " +
      "günstigere Einkäufe und schnelles Basteln aus der Fast-Crafting-Tabelle.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Werkzeugkunde",
        description:
          "Du bist in drei verschiedenen Handwerkszeugen deiner Wahl aus der " +
          "Fast-Crafting-Tabelle geübt.",
        level: 1,
      },
      {
        name: "Rabatt",
        description:
          "Beim Kauf eines nichtmagischen Gegenstands erhältst du 20 Prozent Rabatt.",
        level: 1,
      },
      {
        name: "Schnelles Handwerk",
        description:
          "Wenn du eine lange Rast beendest, kannst du ein Ausrüstungsstück aus der " +
          "Fast-Crafting-Tabelle herstellen, sofern du die zugehörigen Handwerkszeuge " +
          "besitzt und darin geübt bist. Der Gegenstand hält, bis du eine weitere " +
          "lange Rast beendest — dann zerfällt er.\n\n" +
          "Fast-Crafting-Tabelle: Tischlerwerkzeug → Leiter, Fackel; " +
          "Ledererwerkzeug → Bolzenköcher, Karten- oder Schriftrollenköcher, Beutel; " +
          "Maurerwerkzeug → Flaschenzug; Töpferwerkzeug → Krug, Lampe; " +
          "Schmiedewerkzeug → Kugellager, Eimer, Krähenfüße, Enterhaken, Eisentopf; " +
          "Tüftlerwerkzeug → Glocke, Schaufel, Zunderbüchse; " +
          "Weberwerkzeug → Korb, Seil, Netz, Zelt; " +
          "Holzschnitzerwerkzeug → Keule, große Keule, Kampfstab.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "kampfeinweihung",
    name: "Kampfeinweihung",
    nameEn: "Fighting Initiate",
    hook: "Ein Kampfstil ohne Kämpfergrad — und bei jedem Stufenaufstieg austauschbar.",
    description:
      "Du hast einen Kampfstil gelernt, auch ohne das Klassenmerkmal „Kampfstil“. " +
      "Bei jeder neuen Stufe darfst du ihn gegen einen anderen tauschen, den du noch nicht hast.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Kampfstil",
        description:
          "Du erhältst ein Kampfstil-Talent deiner Wahl. Hast du bereits einen Stil, " +
          "muss der gewählte ein anderer sein. Immer wenn du eine neue Stufe erreichst, " +
          "darfst du dieses Kampfstil-Talent durch ein anderes ersetzen, das du noch nicht hast.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "heiler",
    name: "Heiler",
    nameEn: "Healer",
    hook: "Mit Heilerausrüstung Trefferwürfel wecken — und Einsen bei Heilungswürfeln neu werfen.",
    description:
      "Du versorgst Verwundete im Kampf: Heilerausrüstung löst Trefferwürfel aus, " +
      "und Heilungswürfel mit einer 1 darfst du neu werfen.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Feldarzt",
        description:
          "Besitzt du eine Heilerausrüstung, kannst du eine Nutzung davon verbrauchen " +
          "und als Nutzen-Aktion eine Kreatur innerhalb von 1,50 Metern versorgen. " +
          "Die Kreatur darf einen ihrer Trefferwürfel verbrauchen; du wirfst diesen " +
          "Würfel. Die Kreatur erhält Trefferpunkte in Höhe des Wurfs plus deines " +
          "Übungsbonus.",
        level: 1,
      },
      {
        name: "Heilungswurf neu",
        description:
          "Immer wenn du einen Würfel wirfst, um die Anzahl der Trefferpunkte zu " +
          "bestimmen, die du mit einem Zauber oder mit dem Feldarzt-Vorteil dieses " +
          "Talents wiederherstellst, darfst du den Würfel neu werfen, wenn er eine 1 zeigt; " +
          "du musst das neue Ergebnis verwenden.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "glueckspilz",
    name: "Glückspilz",
    nameEn: "Lucky",
    hook: "Glückspunkte gleich Übungsbonus — Vorteil für dich, Nachteil für Angriffe auf dich.",
    description:
      "Du hast Glückspunkte in Höhe deines Übungsbonus. Damit erzwingst du Vorteil " +
      "auf eigene W20-Proben oder Nachteil auf Angriffe gegen dich.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Glückspunkte",
        description:
          "Du hast eine Anzahl Glückspunkte gleich deinem Übungsbonus und kannst sie " +
          "für die folgenden Vorteile ausgeben. Verbrauchte Glückspunkte erhältst du " +
          "nach einer langen Rast zurück.",
        level: 1,
      },
      {
        name: "Vorteil",
        description:
          "Wenn du einen W20 für eine W20-Probe wirfst, kannst du 1 Glückspunkt " +
          "ausgeben, um dir Vorteil auf den Wurf zu geben.",
        level: 1,
      },
      {
        name: "Nachteil",
        description:
          "Wenn eine Kreatur einen W20 für einen Angriffswurf gegen dich wirft, " +
          "kannst du 1 Glückspunkt ausgeben, um diesem Wurf Nachteil aufzuerlegen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "musiker",
    name: "Musiker",
    nameEn: "Musician",
    hook: "Drei Instrumente — und nach der Rast Heldenhafte Inspiration für Verbündete.",
    description:
      "Du beherrschst drei Musikinstrumente und kannst nach einer Rast mit einem " +
      "Lied Heldenhafte Inspiration an Verbündete verteilen.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Instrumentenausbildung",
        description:
          "Du bist in drei Musikinstrumenten deiner Wahl geübt.",
        level: 1,
      },
      {
        name: "Ermutigendes Lied",
        description:
          "Wenn du eine kurze oder lange Rast beendest, kannst du auf einem " +
          "Musikinstrument, in dem du geübt bist, ein Lied spielen und Verbündeten, " +
          "die das Lied hören, Heldenhafte Inspiration geben. Die Anzahl der so " +
          "betroffenen Verbündeten entspricht deinem Übungsbonus.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "wirtshausraufbold",
    name: "Wirtshausraufbold",
    nameEn: "Tavern Brawler",
    hook: "Waffenlose Schläge mit W4 plus Strength, Improvisiertes als Waffe — und einmal pro Zug 1,50 Meter Stoß.",
    description:
      "Du kämpfst mit Fäusten und dem, was greifbar ist: stärkerer waffenloser " +
      "Schaden, Neuwurf bei Einsen, Übung mit improvisierten Waffen und Stoßen.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Verstärkter waffenloser Angriff",
        description:
          "Triffst du mit deinem waffenlosen Angriff und verursachst Schaden, " +
          "kannst du Wuchtschaden in Höhe von 1W4 plus deinem Strength-Modifikator " +
          "verursachen statt des normalen Schadens eines waffenlosen Angriffs.",
        level: 1,
      },
      {
        name: "Schadenswurf neu",
        description:
          "Immer wenn du einen Schadenswürfel für deinen waffenlosen Angriff wirfst, " +
          "darfst du den Würfel neu werfen, wenn er eine 1 zeigt; du musst das neue " +
          "Ergebnis verwenden.",
        level: 1,
      },
      {
        name: "Improvisierte Waffen",
        description: "Du bist im Umgang mit improvisierten Waffen geübt.",
        level: 1,
      },
      {
        name: "Stoßen",
        description:
          "Triffst du eine Kreatur mit einem waffenlosen Angriff als Teil der " +
          "Angriffsaktion an deinem Zug, kannst du dem Ziel Schaden zufügen und es " +
          "zusätzlich 1,50 Meter von dir wegstoßen. Diesen Vorteil kannst du nur " +
          "einmal pro Zug nutzen.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },

  {
    key: "zaeh",
    name: "Zäh",
    nameEn: "Tough",
    hook: "Trefferpunkt-Maximum plus doppelte Charakterstufe — und danach +2 pro Stufe.",
    description:
      "Dein Körper hält mehr aus: Beim Erwerb steigt dein Trefferpunkt-Maximum um " +
      "das Doppelte deiner Charakterstufe; jede weitere Stufe bringt +2 Trefferpunkte.",
    category: "origin",
    prerequisite: null,
    benefits: [
      {
        name: "Zähere Trefferpunkte",
        description:
          "Dein Trefferpunkt-Maximum steigt um einen Betrag gleich dem Doppelten " +
          "deiner Charakterstufe, wenn du dieses Talent erhältst. Immer wenn du " +
          "danach eine Charakterstufe erlangst, steigt dein Trefferpunkt-Maximum um " +
          "weitere 2 Trefferpunkte.",
        level: 1,
      },
    ],
    abilityIncrease: null,
    source: OWNER_NOTES_SOURCE,
  },
];
