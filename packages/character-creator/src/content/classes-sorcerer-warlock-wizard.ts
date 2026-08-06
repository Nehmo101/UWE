/**
 * Klassenkatalog: Hexenmeister, Hexenpakt-Magier, Zauberer.
 *
 * Quelle: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast), Regelstand 2024.
 *
 * ⚠️ Zur deutschen Benennung: UWE bildet seit jeher **Sorcerer = Hexenmeister**,
 * **Warlock = Hexenpakt-Magier** und **Wizard = Zauberer** ab. Das weicht von
 * der offiziellen deutschen Übersetzung ab, ist aber die etablierte Wahrheit in
 * `PICKABLE_CLASSES` (`packages/database/src/character-level-up-service.ts`) und
 * damit an bestehenden Charakterbögen verankert. `nameEn` trägt jeweils das
 * englische Original — daran hängt der SRD-Abgleich. Nicht „korrigieren“.
 *
 * Startausrüstung: SRD 2024 stellt „Wähle A oder B“ — A ist ein Ausrüstungspaket
 * mit Restgold, B ist reines Gold. A steht hier als `EquipmentOption`, B in
 * `startingGoldAlternative`; der Entwurf kennt dafür den Wert `"gold"`.
 */

import type { DndClass } from "../types";
import { SRD_SOURCE } from "../types";

export const CLASSES_SORCERER_WARLOCK_WIZARD: DndClass[] = [
  // ─────────────────────────── Hexenmeister ───────────────────────────
  {
    key: "hexenmeister",
    name: "Hexenmeister",
    nameEn: "Sorcerer",
    hook: "Du hast Magie nie gelernt — sie war schon da, und sie ist ungeduldig: Du biegst deine Zauber im Moment des Wirkens zurecht, während andere noch nachschlagen.",
    description:
      "Magie ist bei dir kein Handwerk, sondern eine Eigenschaft. Irgendetwas in deiner Herkunft hat dich gezeichnet — Drachenblut, ein Ort voller wilder Kraft, ein Ereignis, das du nicht ganz erklären kannst. Du zauberst, wie andere atmen: aus dem Bauch, ohne Buch.\n\nVier Zaubertricks auf Stufe 1 sind die meisten aller Klassen — du hast also von Anfang an Optionen, die nie ausgehen. Der eigentliche Hebel kommt kurz darauf: Ab Stufe 2 wandelst du Zauberpunkte in Zauberplätze und zurück und formst mit Metamagie deine Zauber um — zwei Ziele statt einem, doppelte Reichweite, ohne Geste, schneller.\n\nDafür bist du zerbrechlich: kleinster Trefferwürfel, keine Rüstung. Der Hexenmeister ist die Klasse für Leute, die lieber wenige Zauber richtig gut beherrschen als viele mittelmäßig — und die den Spaß daran haben, Regeln zu verbiegen statt sie zu sammeln.",
    source: SRD_SOURCE,
    hitDie: 6,
    primaryAbilities: ["charisma"],
    savingThrows: ["constitution", "charisma"],
    skills: {
      choose: 2,
      from: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    },
    // SRD 5.2.1: Rüstungstraining „Keine“.
    armorProficiencies: [],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: [],
    spellcasting: {
      progression: "full",
      ability: "charisma",
      // SRD 2024: Der Hexenmeister bereitet Zauber vor (2014 kannte er sie fest).
      preparation: "prepared",
      cantripsKnown: 4,
      spellsKnownAtFirst: 2,
      spellList: "hexenmeister",
    },
    features: [
      {
        name: "Zauberwirken",
        level: 1,
        description:
          "Du schöpfst aus angeborener Magie. Auf Stufe 1 kennst du vier Zaubertricks, bereitest zwei Zauber des 1. Grades vor und hast zwei Zauberplätze des 1. Grades. Charisma ist dein Zauberattribut; ein arkaner Fokus dient als Zauberfokus. Bei jedem Stufenaufstieg darfst du einen Zaubertrick und einen vorbereiteten Zauber austauschen.",
      },
      {
        name: "Angeborene Zauberei",
        level: 1,
        description:
          "Ein Ereignis in deiner Vergangenheit hat dich mit brodelnder Magie durchsetzt. Als Bonusaktion entfesselst du sie für 1 Minute: Der Rettungswurf-Schwierigkeitsgrad deiner Hexenmeisterzauber steigt um 1, und du hast Vorteil auf deren Angriffswürfe. Zwei Anwendungen pro langer Rast.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Ursprung",
    subclasses: [
      {
        key: "drakonische_zauberei",
        name: "Drakonische Zauberei",
        nameEn: "Draconic Sorcery",
        hook: "Drachenblut unter der Haut: härtere Schuppen, mehr Trefferpunkte, und irgendwann ein eigener Odem.",
        description:
          "Deine angeborene Magie ist das Geschenk eines Drachen. Vielleicht hat ein uralter Drache im Sterben einen Teil seiner Kraft an dich oder einen Vorfahren vererbt, vielleicht hast du Magie an einem drachendurchwirkten Ort aufgesogen — oder du hast schlicht einen Drachen im Stammbaum.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Drakonische Widerstandskraft",
            level: 3,
            description:
              "Dein Trefferpunktemaximum steigt um 3 und danach um 1 pro weiterer Hexenmeisterstufe. Drachenartige Schuppen bedecken Teile deines Körpers: Ohne Rüstung beträgt deine Rüstungsklasse 10 plus Geschicklichkeits- plus Charisma-Modifikator.",
          },
          {
            name: "Drakonische Zauber",
            level: 3,
            description:
              "Ab bestimmten Stufen hast du feste Zauber dauerhaft vorbereitet. Auf Stufe 3 sind das „Selbstverwandlung“, „Chromatische Kugel“, „Befehl“ und „Drachenodem“.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Fokus und leichte Bewaffnung",
        items: [
          { name: "Speer", quantity: 1 },
          { name: "Dolch", quantity: 2 },
          { name: "Arkaner Fokus", quantity: 1, notes: "Kristall" },
          { name: "Höhlenforscherpaket", quantity: 1 },
        ],
        gold: 28,
      },
    ],
    startingGoldAlternative: 50,
    roleTags: ["Zauberei", "Flächenschaden", "Metamagie", "Gesellschaft"],
    complexity: 2,
    art: "/character-creator/classes/hexenmeister.svg",
  },

  // ──────────────────────── Hexenpakt-Magier ────────────────────────
  {
    key: "hexenpakt_magier",
    name: "Hexenpakt-Magier",
    nameEn: "Warlock",
    hook: "Du hast einen Handel geschlossen, dessen Preis noch nicht fällig ist — dafür füllen sich deine Zauberplätze schon nach einer kurzen Rast wieder.",
    description:
      "Irgendetwas Mächtiges hat dir geantwortet, als du gerufen hast: ein Unhold, ein Wesen aus dem Feenreich, etwas Namenloses zwischen den Sternen. Die Gegenleistung steht aus. Was du bekommen hast, ist konkret: Pakt-Magie.\n\nPakt-Magie funktioniert anders als jede andere Zauberei im Spiel. Du hast sehr wenige Zauberplätze — auf Stufe 1 genau einen — aber sie kehren schon nach einer kurzen Rast zurück und sie steigen immer automatisch auf den höchsten Grad, den du beherrschst. Dazu kommen Schauerliche Anrufungen: dauerhafte, frei wählbare Fähigkeiten, die deine Figur mehr prägen als jede Zauberliste. Wer „Schauerlicher Strahl“ nimmt, hat einen Zaubertrick, der den ganzen Tag trägt.\n\nDas ist die anspruchsvollste der drei Charisma-Klassen: Zwei Ressourcen mit unterschiedlichem Rhythmus, eine Anrufungs-Liste, die man lesen muss, und ein Patron, der irgendwann etwas will. Dafür spielt sich keine andere Klasse so.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["charisma"],
    savingThrows: ["wisdom", "charisma"],
    skills: {
      choose: 2,
      from: [
        "arcana",
        "deception",
        "history",
        "intimidation",
        "investigation",
        "nature",
        "religion",
      ],
    },
    armorProficiencies: ["Leichte Rüstung"],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: [],
    spellcasting: {
      progression: "pact",
      ability: "charisma",
      // SRD 2024: Der Hexenpakt-Magier bereitet Zauber vor (2014 kannte er sie fest).
      preparation: "prepared",
      cantripsKnown: 2,
      spellsKnownAtFirst: 2,
      spellList: "hexenpakt_magier",
    },
    features: [
      {
        name: "Schauerliche Anrufungen",
        level: 1,
        description:
          "Du hast Bruchstücke verbotenen Wissens ausgegraben, die dir eine dauerhafte magische Fähigkeit verleihen. Auf Stufe 1 wählst du eine Anrufung, etwa „Pakt des Folianten“. Manche Anrufungen haben Voraussetzungen. Bei jedem Stufenaufstieg darfst du eine Anrufung austauschen; auf höheren Stufen kommen weitere hinzu.",
      },
      {
        name: "Pakt-Magie",
        level: 1,
        description:
          "Durch eine okkulte Zeremonie hast du einen Pakt geschlossen. Auf Stufe 1 kennst du zwei Zaubertricks, bereitest zwei Zauber des 1. Grades vor und hast einen Zauberplatz des 1. Grades. Alle deine Zauberplätze haben stets denselben, höchstmöglichen Grad — und du erhältst sie bereits nach einer kurzen Rast zurück. Charisma ist dein Zauberattribut; ein arkaner Fokus dient als Zauberfokus.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Jenseitiger Patron",
    subclasses: [
      {
        key: "unhold_patron",
        name: "Unhold-Patron",
        nameEn: "Fiend Patron",
        hook: "Ein Handel mit den Unteren Ebenen: Jeder Gegner, der fällt, macht dich zäher.",
        description:
          "Dein Pakt speist sich aus den Unteren Ebenen, den Reichen der Verdammnis. Vielleicht hast du mit einem Dämonenfürsten verhandelt, mit einem Erzteufel oder mit einem anderen besonders mächtigen Unhold. Die Ziele dieses Patrons sind böse — die Verderbnis oder Zerstörung aller Dinge, am Ende auch deiner. Dein Weg bemisst sich daran, wie weit du dich dagegen stemmst.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Segen des Dunklen",
            level: 3,
            description:
              "Bringst du einen Feind auf 0 Trefferpunkte, erhältst du temporäre Trefferpunkte in Höhe deines Charisma-Modifikators plus deiner Hexenpakt-Magier-Stufe (mindestens 1). Dasselbe gilt, wenn jemand anderes einen Feind im Umkreis von 3 Metern niederstreckt.",
          },
          {
            name: "Unhold-Zauber",
            level: 3,
            description:
              "Ab bestimmten Stufen hast du feste Zauber dauerhaft vorbereitet. Auf Stufe 3 sind das „Brennende Hände“, „Befehl“, „Sengender Strahl“ und „Suggestion“.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Okkultes Handwerkszeug",
        items: [
          { name: "Lederrüstung", quantity: 1 },
          { name: "Sichel", quantity: 1 },
          { name: "Dolch", quantity: 2 },
          { name: "Arkaner Fokus", quantity: 1, notes: "Kugel" },
          { name: "Buch", quantity: 1, notes: "okkultes Wissen" },
          { name: "Gelehrtenpaket", quantity: 1 },
        ],
        gold: 15,
      },
    ],
    startingGoldAlternative: 100,
    roleTags: ["Zauberei", "Fluch und Kontrolle", "Anrufungen", "Gesellschaft"],
    complexity: 3,
    art: "/character-creator/classes/hexenpakt_magier.svg",
  },

  // ───────────────────────────── Zauberer ─────────────────────────────
  {
    key: "zauberer",
    name: "Zauberer",
    nameEn: "Wizard",
    hook: "Dein Zauberbuch wächst mit jedem Abenteuer — und irgendwann steht darin für jedes Problem der Gruppe die passende Seite.",
    description:
      "Der Zauberer hat sich seine Magie erarbeitet: durch Studium, Notizen, gestohlene Schriftrollen und ein Buch, das nur er lesen kann. Auf Stufe 1 stehen sechs Zauber des 1. Grades darin; vier davon bereitest du vor, und nach jeder langen Rast stellst du die Auswahl neu zusammen.\n\nGenau das ist der Unterschied zu allen anderen Zauberklassen: Deine Liste ist nicht festgelegt, sie wächst. Jede Stufe bringt zwei neue Zauber ins Buch, jede gefundene Schriftrolle potenziell noch einen. Ein Zauberer auf Stufe 10 kann Dinge, die kein Spielleiter vorhergesehen hat — und genau darin liegt der Ruf der Klasse.\n\nDer Preis: d6-Trefferwürfel, keine Rüstung, und du musst wissen, was in deinem Buch steht. Wer gern plant, gern Ressourcen verwaltet und den Kick daran hat, mit dem richtigen Zauber zur richtigen Zeit eine ganze Szene aufzulösen, findet hier die tiefste Klasse im Spiel.",
    source: SRD_SOURCE,
    hitDie: 6,
    primaryAbilities: ["intelligence"],
    savingThrows: ["intelligence", "wisdom"],
    skills: {
      choose: 2,
      from: ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"],
    },
    // SRD 5.2.1: Rüstungstraining „Keine“.
    armorProficiencies: [],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: [],
    spellcasting: {
      progression: "full",
      ability: "intelligence",
      preparation: "prepared",
      cantripsKnown: 3,
      // Vier vorbereitete Zauber laut Klassentabelle — gewählt aus den sechs
      // Zaubern des 1. Grades, mit denen das Zauberbuch startet (siehe Merkmal
      // „Zauberwirken“). Die Sechs sind Besitz, die Vier sind die Tagesauswahl.
      spellsKnownAtFirst: 4,
      spellList: "zauberer",
    },
    features: [
      {
        name: "Zauberwirken",
        level: 1,
        description:
          "Du kennst drei Zaubertricks. Dein Zauberbuch startet mit sechs Zaubern des 1. Grades deiner Wahl; daraus bereitest du vier vor, die du mit deinen zwei Zauberplätzen des 1. Grades wirken kannst. Nach jeder langen Rast stellst du die vorbereitete Auswahl komplett neu zusammen. Ab Stufe 2 kommen bei jedem Stufenaufstieg zwei weitere Zauber ins Buch. Intelligenz ist dein Zauberattribut; arkaner Fokus oder das Zauberbuch selbst dienen als Fokus.",
      },
      {
        name: "Ritualmeister",
        level: 1,
        description:
          "Jeden Zauber mit dem Ritual-Merkmal, der in deinem Zauberbuch steht, kannst du als Ritual wirken — auch dann, wenn du ihn nicht vorbereitet hast. Du musst dabei aus dem Buch lesen.",
      },
      {
        name: "Arkane Erholung",
        level: 1,
        description:
          "Nach einer kurzen Rast studierst du dein Zauberbuch und gewinnst verbrauchte Zauberplätze zurück, deren Grade zusammen höchstens die Hälfte deiner Zaubererstufe ergeben (aufgerundet); kein Platz darf dabei Grad 6 oder höher sein. Danach erst wieder nach einer langen Rast.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Arkane Tradition",
    subclasses: [
      {
        key: "hervorrufer",
        name: "Hervorrufer",
        nameEn: "Evoker",
        hook: "Feuer, Frost, Blitz und Donner — und deine Zaubertricks treffen selbst dann noch, wenn du danebenliegst.",
        description:
          "Dein Studium gilt der Magie, die gewaltige elementare Wirkungen erzeugt: beißende Kälte, sengende Flammen, rollender Donner, knisternde Blitze, ätzende Säure. Manche Hervorrufer verdingen sich als Artillerie in Heeren, andere nutzen ihre Kraft zum Schutz — und wieder andere für den eigenen Vorteil.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Meister der Hervorrufung",
            level: 3,
            description:
              "Du wählst zwei Zaubererzauber der Schule Hervorrufung, jeweils höchstens Grad 2, und trägst sie kostenlos in dein Zauberbuch ein. Zusätzlich darfst du jedes Mal, wenn du Zugang zu einem neuen Zauberplatz-Grad erhältst, einen weiteren Hervorrufungszauber kostenlos eintragen.",
          },
          {
            name: "Wirkungsvoller Zaubertrick",
            level: 3,
            description:
              "Deine schadenverursachenden Zaubertricks wirken auch auf Ziele, die ausweichen: Verfehlst du mit dem Angriffswurf oder gelingt dem Ziel sein Rettungswurf, erleidet es trotzdem den halben Schaden — allerdings keine Zusatzwirkung.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Buch, Robe und Kampfstab",
        items: [
          { name: "Dolch", quantity: 2 },
          { name: "Arkaner Fokus", quantity: 1, notes: "Kampfstab" },
          { name: "Robe", quantity: 1 },
          { name: "Zauberbuch", quantity: 1 },
          { name: "Gelehrtenpaket", quantity: 1 },
        ],
        gold: 5,
      },
    ],
    startingGoldAlternative: 55,
    roleTags: ["Zauberei", "Kontrolle", "Wissen", "Flächenschaden"],
    complexity: 3,
    art: "/character-creator/classes/zauberer.svg",
  },
];
