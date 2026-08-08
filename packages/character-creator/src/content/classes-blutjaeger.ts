/**
 * Klasse Blutjäger (Bloodhunter) — Owner-Notizen-Import.
 *
 * Mechanik aus den Owner-Notizen; Flavour für Terra (Validori / Nepurga /
 * Arbor-Saum), ohne Tegora. Kein Zaubern auf Klassenstufe 1 — Unterklassen
 * ab Stufe 3 (Okkulte Orden).
 */

import { OWNER_NOTES_SOURCE, type DndClass } from "../types";

export const CLASSES_BLUTJAEGER: DndClass[] = [
  {
    key: "blutjaeger",
    name: "Blutjäger",
    nameEn: "Bloodhunter",
    hook: "Du opferst eigenes Blut, um Unheil zu jagen — Riten, Flüche und der Preis der Hunter's Bane.",
    description:
      "Blutjäger beherrschen Hemokraft: Riten, die Vitalität kosten, um Monster zu treffen, die göttlicher Zucht oder arkaner Bindung widerstehen. Am Arbor-Saum und in den Schatten Validoris gelten sie als unheimlich — nützlich, aber gemieden. Der Orden ist oft die einzige Familie, die bleibt.\n\nAuf Stufe 1: Hunter's Bane (okkultes Wissen und Sinistere Einsicht), Kampfstil und Waffenmeisterschaft. Blutriten und Purpur-Opfer folgen auf Stufe 2; der Okkulte Orden auf Stufe 3. Kein Klassen-Zaubern auf Stufe 1 — außer später über den Orden der Hexenritter.",
    source: OWNER_NOTES_SOURCE,
    hitDie: 12,
    primaryAbilities: ["constitution"],
    savingThrows: ["constitution", "intelligence"],
    skills: {
      choose: 2,
      from: [
        "athletics",
        "acrobatics",
        "arcana",
        "history",
        "insight",
        "investigation",
        "nature",
        "religion",
        "survival",
      ],
    },
    armorProficiencies: ["Leichte Rüstung", "Mittelschwere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen", "Kriegswaffen"],
    toolProficiencies: ["Alchemistenausrüstung"],
    spellcasting: null,
    features: [
      {
        name: "Hunter's Bane",
        level: 1,
        description:
          "Nach dem dunklen Ritual: Okkultes Wissen — Übung in Arkane Kunde, Naturkunde oder Religion (bei bereits vorhandener Übung Expertise). Sinistere Einsicht: Bonusaktion, eine sichtbare Kreatur in 9 m analysieren; Constitution-Probe mit der passenden Fertigkeit (SG 8 + KR). Bei Erfolg eine Eigenschaft deiner Wahl (AC, Attribute, Sinne, Resistenzen/Immunitäten/Verwundbarkeiten, ein Trait/eine Aktion). Bei Misserfolg erst wieder nach langer Rast oder nachdem du sie mit Waffe oder Blutritus verletzt hast.",
      },
      {
        name: "Kampfstil",
        level: 1,
        description:
          "Du erhältst ein Kampfstil-Talent deiner Wahl. Bei jedem Stufenaufstieg als Blutjäger darfst du es gegen ein anderes Kampfstil-Talent tauschen.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du beherrschst die Meisterschaftseigenschaften von zwei Waffenarten deiner Wahl, in denen du geübt bist. Nach langer Rast darfst du die Wahl ändern.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Okkulter Orden",
    subclasses: [
      {
        key: "orden-der-alchemisten",
        name: "Orden der Alchemisten",
        nameEn: "Order of the Alchemist",
        hook: "Drei latente Mutagene im Blut — als Bonusaktion mutierst du und triffst Monster auf Augenhöhe.",
        description:
          "Dieser Orden nutzt dunkle Alchemie und Transmutation. Mutagene verändern den Körper, bis der Jäger dem Ungeheuer ebenbürtig wird — ein Pfad, den Gildenlaboratorien Validoris offiziell verleugnen.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Abweichende Alchemie",
            level: 3,
            description:
              "Drei latente Mutagene deiner Wahl. Bonusaktion Mutieren: Nutzen so vieler Mutagene wie Constitution-Modifikator (min. 1), 10 Minuten. Einmal pro kurzer/langer Rast kostenlos, danach Vital Sacrifice. Während langer Rast ein Mutagen tauschbar.",
          },
          {
            name: "Monströses Gespür",
            level: 3,
            description:
              "Bei Proben mit Alchemistenausrüstung oder Sinisterer Einsicht gegen Aberration, Monstrosität oder Schleim addierst du deinen Rite Die.",
          },
        ],
      },
      {
        key: "orden-der-ketzer",
        name: "Orden der Ketzer",
        nameEn: "Order of Heretics",
        hook: "Kanalisierte Göttlichkeit trotz Bann — zwei Channel Divinity und Kleriker-Zaubertricks aus verbotenen Riten.",
        description:
          "Aus religiösen Orden ausgestoßen, verbinden diese Jäger heilige Kenntnis mit Blutmagie. Sie jagen abtrünnige göttliche Wesen — gut wie böse — an Schreinen und in den Schatten Validoris.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Lästerliches Gebet",
            level: 3,
            description:
              "Zwei Channel-Divinity-Optionen: Göttliches tadeln (Celestials, Fiends oder göttlich Zaubernde in 9 m: Charisma-Rettungswurf oder handlungsunfähig 1 Minute) und eine Option aus Kleriker-Domänen Stufe 2 (Blutjägerstufe statt Klerikerstufe, Rite-SG). Je einmal, zurück nach kurzer Rast.",
          },
          {
            name: "Ketzerisches Wissen",
            level: 3,
            description:
              "Übung in Religion (sonst Expertise). Zwei Zaubertricks der Klerikerliste (Constitution als Zauberattribut). Bei Hunter's Bane gegen Celestial, Fiend oder Untote: + Rite Die.",
          },
        ],
      },
      {
        key: "orden-des-blassen-mondes",
        name: "Orden des Blassen Mondes",
        nameEn: "Order of the Pale Moon",
        hook: "Du trägst bewusst die Lykanthropie — Bestien- oder Hybridgestalt, um Werwesen und Gestaltwandler zu jagen.",
        description:
          "Manche Blutjäger infizieren sich absichtlich mit einem Bestienfluch (CR 1 oder niedriger), um Werwesen und andere Wandlungen zu bekämpfen — oft am Arbor-Saum, wo die Grenze zwischen Mensch und Bestie dünn ist.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Wilde Sinne",
            level: 3,
            description:
              "Bei Wahrnehmungs- oder Überlebensproben über Sicht, Gehör oder Geruch: + Rite Die. Sinistere Einsicht gegen Beast, Monstrosity oder Shapeshifter: + Rite Die.",
          },
          {
            name: "Lykanthropie",
            level: 3,
            description:
              "Bonusaktion Shift in Bestien- oder Hybridgestalt (bis 1 Stunde). Einmal pro Rast kostenlos, danach Vital Sacrifice. Bestie: Werte der Bestie, eigene TP/Personality/Int/Wis/Cha; natürliche Waffen nutzen Rite Die. Hybrid: +3 m Tempo, Klettertempo, unbewaffnete Angriffe mit Finesse und Rite-Die-Schaden; Bonusaktion unbewaffneter Schlag oder Sprint auf Feind.",
          },
        ],
      },
      {
        key: "orden-von-salz-und-eisen",
        name: "Orden von Salz und Eisen",
        nameEn: "Order of Salt & Iron",
        hook: "Spektraler Zustand und strahlendes Purpur-Opfer — Exorzisten gegen die Untotenflut.",
        description:
          "Seit Alters her trainiert dieser Orden Exorzisten gegen Untote. Sie beflecken die eigene Seele mit Geisterkraft, um Dunkelheit mit Dunkelheit zu schlagen — entlang Nepurgas Gräberstraßen und Validoris Katakomben.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Spektrale Natur",
            level: 3,
            description:
              "Halb so viel Schlaf/Essen/Trinken. Bonusaktion Spektraler Zustand bis Zugende: Resistenz gegen Hieb/Stich/Schnitt, durch Kreaturen/Objekte wie schwieriges Gelände; steckenbleiben kostet Force-Schaden. Anwendungen: Constitution-Modifikator (min. 1), danach Vital Sacrifice.",
          },
          {
            name: "Krieger der Morgendämmerung",
            level: 3,
            description:
              "Hunter's Bane gegen Untote: + Rite Die. Purpur-Opfer kann strahlenden Bonusschaden, Resistenz gegen nekrotischen Schaden und helles Licht (9 m) verleihen.",
          },
        ],
      },
      {
        key: "orden-des-unsterblichen-durstes",
        name: "Orden des Unsterblichen Durstes",
        nameEn: "Order of Undying Thirst",
        hook: "Vampirischer Fluch als Werkzeug — größere Ritenwürfel, Fangzähne und nekrotisches Purpur-Opfer.",
        description:
          "Der Orden führt den Kampf gegen Vampire mit demselben Fluch, den er tilgen will. In den Nachtgassen Validoris und an verlassenen Handelswegen Nepurgas halten sie den Gründerschwur.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Blutmagie-Spezialist",
            level: 3,
            description:
              "Ein zusätzlicher Blutritus (zählt nicht gegen das Limit). Rite Die wird d6 (steigt später weiter). Purpur-Opfer darf nekrotischen Bonusschaden wählen.",
          },
          {
            name: "Vampirische Natur",
            level: 3,
            description:
              "Zähne als unbewaffnete Angriffe: nekrotischer Schaden = Rite Die + Strength-Modifikator. Sinistere Einsicht gegen Untote: + dein Rite Die.",
          },
        ],
      },
      {
        key: "orden-der-hexenritter",
        name: "Orden der Hexenritter",
        nameEn: "Order of the Witch Knight",
        hook: "Paktmagie wie ein Hexenpakt-Magier — Constitution als Zauberattribut, Klinge als Fokus.",
        description:
          "Hexenritter schließen Bund mit eldritchen Mächten, um große Übel zu vernichten. Der Preis ist ein Stück Seele — Macht, die in Validori hinter verschlossenen Gildentüren geflüstert wird.",
        source: OWNER_NOTES_SOURCE,
        features: [
          {
            name: "Paktmagie",
            level: 3,
            description:
              "Zwei Zaubertricks und zwei vorbereitete Zauber des 1. Grades von der Hexenpakt-Magier-Liste; Constitution ist Zauberattribut. Zauberplätze laut Hexenritter-Tabelle, alle zurück nach kurzer/langer Rast. Bei Multiclass mit Hexenpakt-Magier: Warlock-Stufen + ein Drittel Blutjägerstufen (aufgerundet).",
          },
          {
            name: "Purpurklinge",
            level: 3,
            description:
              "Eine Waffe unter Purpur-Opfer dient als Zauberfokus für Hexenritter-Zauber.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Kriegswaffe, Nietleder und Alchemistenausrüstung",
        gold: 0,
        items: [
          { name: "Kriegswaffe deiner Wahl", quantity: 1 },
          { name: "Leichte Armbrust", quantity: 1 },
          { name: "Bolzen", quantity: 20 },
          { name: "Nietlederrüstung", quantity: 1 },
          { name: "Entdeckerpaket", quantity: 1 },
          { name: "Alchemistenausrüstung", quantity: 1 },
        ],
      },
      {
        key: "b",
        label: "B — Zwei einfache Waffen, Schuppenpanzer und Alchemistenausrüstung",
        gold: 0,
        items: [
          { name: "Einfache Waffe", quantity: 2 },
          { name: "Leichte Armbrust", quantity: 1 },
          { name: "Bolzen", quantity: 20 },
          { name: "Schuppenpanzer", quantity: 1 },
          { name: "Entdeckerpaket", quantity: 1 },
          { name: "Alchemistenausrüstung", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: null,
    roleTags: ["Nahkampf", "Schadensbringer", "Frontlinie", "Opfermagie"],
    complexity: 3,
  },
];
