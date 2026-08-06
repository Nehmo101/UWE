/**
 * Klassenkatalog, Teil 1: Barbar, Barde, Kleriker.
 *
 * Inhalt aus dem SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast) — den Regeln von
 * 2024. Namen und Prosa sind deutsch, `nameEn` hält das englische Original
 * fest, damit Zauber- und Ausrüstungssuche gegen die SRD-Quelle abgleichbar
 * bleibt.
 *
 * Zwei Konventionen, die dieser und der Schwesterdatei gemeinsam sind:
 * - `spellcasting.spellList` trägt denselben Schlüssel wie die Klasse
 *   (`"barde"`, `"kleriker"`, …). Die Zauberliste hängt damit an der Klasse
 *   und nicht an einer zweiten, frei erfundenen Namensmenge.
 * - `startingEquipment` enthält nur die Sach-Optionen. Die reine Goldvariante
 *   des SRD steht in `startingGoldAlternative`, weil der Entwurf sie über
 *   `equipmentChoice === "gold"` getrennt führt.
 *
 * `roleTags` und `complexity` stehen so nicht im SRD — das ist UWEs eigene
 * Einschätzung als Entscheidungshilfe am Tisch.
 */

import { SRD_SOURCE, type DndClass } from "../types";

export const CLASSES_BARBARIAN_BARD_CLERIC: DndClass[] = [
  {
    key: "barbar",
    name: "Barbar",
    nameEn: "Barbarian",
    hook: "Du gehst als Erster durch die Tür, steckst die Schläge weg, die sonst deine Freunde träfen, und schlägst mit einer Wut zurück, gegen die Rüstung wenig hilft.",
    description:
      "Der Barbar kämpft aus einem Zorn heraus, den er anzapfen kann wie eine Quelle. Solange die Wut brennt, prallen Hiebe, Stiche und Schnitte halbiert an ihm ab, seine Kraft wächst und jeder Treffer sitzt tiefer. Rüstung braucht er dafür kaum: Wer ungepanzert bleibt, verlässt sich auf Reflexe und Zähigkeit zugleich.\n\nAm Tisch ist der Barbar die einfachste Wahl mit der größten Wirkung. Er hat die meisten Trefferpunkte im Spiel, wenige Entscheidungen pro Runde und eine klare Aufgabe — vorne stehen und die Aufmerksamkeit der Gegner auf sich ziehen. Der Preis: Während die Wut läuft, sind Zauber und Konzentration tabu.",
    source: SRD_SOURCE,
    hitDie: 12,
    primaryAbilities: ["strength"],
    savingThrows: ["strength", "constitution"],
    skills: {
      choose: 2,
      from: [
        "animal_handling",
        "athletics",
        "intimidation",
        "nature",
        "perception",
        "survival",
      ],
    },
    armorProficiencies: ["Leichte Rüstung", "Mittelschwere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen", "Kriegswaffen"],
    toolProficiencies: [],
    spellcasting: null,
    features: [
      {
        name: "Wut",
        level: 1,
        description:
          "Als Bonusaktion kannst du in Wut geraten, solange du keine schwere Rüstung trägst — auf Stufe 1 zweimal pro Rast-Zyklus (eine Anwendung zurück nach einer kurzen Rast, alle nach einer langen). Während die Wut läuft: Resistenz gegen Wucht-, Stich- und Hiebschaden, +2 Schaden auf Stärke-Angriffe, Vorteil auf Stärkeproben und Stärke-Rettungswürfe. Zaubern und Konzentration sind ausgeschlossen. Die Wut hält bis zum Ende deines nächsten Zuges und verlängert sich um eine Runde, wenn du angreifst, einen Gegner zu einem Rettungswurf zwingst oder eine Bonusaktion dafür einsetzt — höchstens 10 Minuten am Stück.",
      },
      {
        name: "Ungepanzerte Verteidigung",
        level: 1,
        description:
          "Ohne Rüstung ist deine Grundrüstungsklasse 10 + Geschicklichkeits- + Konstitutionsmodifikator. Ein Schild ist dabei erlaubt.",
      },
      {
        name: "Waffenmeisterschaft",
        level: 1,
        description:
          "Du beherrschst die Meisterschaftseigenschaft von zwei Arten einfacher oder kriegerischer Nahkampfwaffen deiner Wahl (etwa Großaxt und Handaxt). Nach jeder langen Rast darfst du eine der beiden Wahlen austauschen.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Pfad",
    subclasses: [
      {
        key: "pfad-des-berserkers",
        name: "Pfad des Berserkers",
        nameEn: "Path of the Berserker",
        hook: "Rücksichtsloser Angriff wird bei dir zum Nachschlag: Wer sich selbst preisgibt, trifft dafür verheerend.",
        description:
          "Berserker lenken ihre Wut ausschließlich nach außen. Sie suchen das Chaos der Schlacht und lassen sich von der eigenen Raserei tragen, statt sie zu zügeln.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Raserei",
            level: 3,
            description:
              "Setzt du während deiner Wut Rücksichtsloser Angriff ein, verursacht dein erster Stärke-Treffer im Zug Zusatzschaden: so viele W6, wie dein Wutschadensbonus beträgt, im Schadenstyp der verwendeten Waffe oder des waffenlosen Schlags.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Großaxt und Wurfäxte",
        gold: 15,
        items: [
          { name: "Großaxt", quantity: 1 },
          { name: "Handaxt", quantity: 4 },
          { name: "Entdeckerpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 75,
    roleTags: ["Nahkampf", "Schadensbringer", "Zäh", "Frontlinie"],
    complexity: 1,
    art: "/character-creator/classes/barbar.svg",
  },

  {
    key: "barde",
    name: "Barde",
    nameEn: "Bard",
    hook: "Du löst mit einem Satz, wofür andere eine Schlacht brauchen — und wenn es doch zur Schlacht kommt, ist dein Zuruf genau der Würfel, der den Angriff des Kämpfers rettet.",
    description:
      "Der Barde wirkt Magie aus Wort, Musik und Auftritt. Er zaubert aus der vollen Bardenliste, redet Wachen weich, kennt sich überall ein wenig aus — und teilt seine wichtigste Fähigkeit an andere aus: Bardische Inspiration ist ein Würfel, den ein Mitspieler bis zu eine Stunde später auf einen misslungenen Wurf legen darf.\n\nDas macht den Barden zum Verstärker der Gruppe. Er ist selten der, der den Schlag setzt, aber fast immer der, der ihn möglich macht. Drei frei wählbare Fertigkeiten und drei Musikinstrumente geben ihm dazu die breiteste Ausbildung aller Klassen.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["charisma"],
    savingThrows: ["dexterity", "charisma"],
    // SRD: „Choose any 3 skills" — leere Liste heißt hier: alle 18 stehen offen.
    skills: { choose: 3, from: [] },
    armorProficiencies: ["Leichte Rüstung"],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: ["Drei Musikinstrumente deiner Wahl"],
    spellcasting: {
      progression: "full",
      ability: "charisma",
      // SRD 2024 nennt die Liste „Prepared Spells", tauschbar ist sie aber nur
      // beim Stufenaufstieg — für den Ersteller verhält sie sich wie eine
      // feste Auswahl, deshalb "known".
      preparation: "known",
      cantripsKnown: 2,
      spellsKnownAtFirst: 4,
      spellList: "barde",
    },
    features: [
      {
        name: "Bardische Inspiration",
        level: 1,
        description:
          "Als Bonusaktion gibst du einer Kreatur in 18 Metern, die dich sehen oder hören kann, einen Inspirationswürfel (W6). Innerhalb der nächsten Stunde darf sie ihn bei einem misslungenen W20-Wurf würfeln und das Ergebnis addieren — der Fehlschlag kann so noch zum Erfolg werden. Anwendungen: Charismamodifikator (mindestens einmal), zurück nach einer langen Rast.",
      },
      {
        name: "Zaubern",
        level: 1,
        description:
          "Du wirkst Zauber aus der Bardenliste mit Charisma als Zauberattribut; ein Musikinstrument dient als Zauberfokus. Auf Stufe 1 kennst du zwei Zaubertricks und wählst vier Zauber des 1. Grades. Bei jedem Stufenaufstieg darfst du einen Zaubertrick und einen Zauber austauschen.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Kollegium",
    subclasses: [
      {
        key: "kollegium-des-wissens",
        name: "Kollegium des Wissens",
        nameEn: "College of Lore",
        hook: "Drei zusätzliche Fertigkeiten und ein spitzer Kommentar, der einem Gegner den Treffer wieder abnimmt.",
        description:
          "Barden dieses Kollegiums sammeln Zauber und Geheimnisse aus jeder Quelle — aus Gelehrtenbänden, mystischen Riten und Bauernmärchen. Man trifft sie in Bibliotheken ebenso wie auf Staatsempfängen, wo sie Korruption bloßstellen und Wichtigtuer der Lächerlichkeit preisgeben.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Zusätzliche Übungen",
            level: 3,
            description:
              "Du wirst in drei weiteren Fertigkeiten deiner Wahl geübt.",
          },
          {
            name: "Schneidende Worte",
            level: 3,
            description:
              "Wenn eine sichtbare Kreatur in 18 Metern Schaden würfelt oder eine Attributsprobe bzw. einen Angriffswurf schafft, darfst du als Reaktion eine Anwendung Bardischer Inspiration ausgeben: Würfle den Inspirationswürfel und ziehe das Ergebnis von ihrem Wurf ab — aus dem Erfolg kann so noch ein Fehlschlag werden.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Lederrüstung, Dolche und Instrument",
        gold: 19,
        items: [
          { name: "Lederrüstung", quantity: 1 },
          { name: "Dolch", quantity: 2 },
          { name: "Musikinstrument deiner Wahl", quantity: 1 },
          { name: "Unterhalterpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 90,
    roleTags: [
      "Unterstützung",
      "Anführer",
      "Kontrolle",
      "Fernkampf",
      "Gesellschaft",
    ],
    complexity: 2,
    art: "/character-creator/classes/barde.svg",
  },

  {
    key: "kleriker",
    name: "Kleriker",
    nameEn: "Cleric",
    hook: "Wenn jemand auf 0 Trefferpunkte fällt, schaut die ganze Gruppe zu dir — und du holst ihn zurück, in Kettenhemd und mit dem Streitkolben noch in der Hand.",
    description:
      "Der Kleriker trägt die Macht einer Gottheit ins Feld. Er heilt, segnet, vertreibt Untote und steht dabei in Rüstung und mit Schild in der zweiten Reihe — nicht als zerbrechlicher Zauberwirker, sondern als jemand, der einen Treffer aushält.\n\nSeine Zauberliste bereitet er nach jeder langen Rast neu vor: Der Kleriker hat Zugriff auf alles, was seine Klasse kennt, und entscheidet morgens, was heute gebraucht wird. Das ist mächtig und verlangt Planung — deshalb ist er nicht die schwerste, aber auch nicht die anspruchsloseste Klasse. Der Göttliche Orden legt auf Stufe 1 fest, ob er eher Kämpfer (Beschützer) oder eher Zauberwirker (Thaumaturg) ist.",
    source: SRD_SOURCE,
    hitDie: 8,
    primaryAbilities: ["wisdom"],
    savingThrows: ["wisdom", "charisma"],
    skills: {
      choose: 2,
      from: ["history", "insight", "medicine", "persuasion", "religion"],
    },
    armorProficiencies: ["Leichte Rüstung", "Mittelschwere Rüstung", "Schilde"],
    weaponProficiencies: ["Einfache Waffen"],
    toolProficiencies: [],
    spellcasting: {
      progression: "full",
      ability: "wisdom",
      preparation: "prepared",
      cantripsKnown: 3,
      spellsKnownAtFirst: 4,
      spellList: "kleriker",
    },
    features: [
      {
        name: "Zaubern",
        level: 1,
        description:
          "Du wirkst Zauber aus der Klerikerliste mit Weisheit als Zauberattribut; ein heiliges Symbol dient als Zauberfokus. Auf Stufe 1 kennst du drei Zaubertricks und bereitest vier Zauber des 1. Grades vor. Nach jeder langen Rast darfst du die vorbereitete Liste vollständig neu zusammenstellen.",
      },
      {
        name: "Göttlicher Orden",
        level: 1,
        description:
          "Du wählst eine geweihte Rolle. Beschützer: Übung mit Kriegswaffen und Ausbildung an schwerer Rüstung. Thaumaturg: ein zusätzlicher Zaubertrick von der Klerikerliste und ein Bonus in Höhe deines Weisheitsmodifikators (mindestens +1) auf Intelligenzproben für Arkane Kunde und Religion.",
      },
    ],
    subclassLevel: 3,
    subclassLabel: "Domäne",
    subclasses: [
      {
        key: "domaene-des-lebens",
        name: "Domäne des Lebens",
        nameEn: "Life Domain",
        hook: "Jede deiner Heilungen fällt größer aus, als sie auf dem Blatt steht — und einmal pro Rast hebst du eine ganze Gruppe wieder auf die Beine.",
        description:
          "Die Domäne des Lebens speist sich aus der positiven Energie, die alles Leben im Multiversum trägt. Kleriker, die sie anzapfen, sind Meister der Heilung. Sie findet sich bei Erntegottheiten ebenso wie bei Göttern der Ausdauer, des Heims und der Gemeinschaft — und bei jedem Heilorden.",
        source: SRD_SOURCE,
        features: [
          {
            name: "Jünger des Lebens",
            level: 3,
            description:
              "Stellt ein mit einem Zauberplatz gewirkter Zauber Trefferpunkte wieder her, erhält das Ziel im selben Zug zusätzliche Trefferpunkte in Höhe von 2 + Grad des Zauberplatzes.",
          },
          {
            name: "Zauber der Domäne des Lebens",
            level: 3,
            description:
              "Ab Stufe 3 hast du Hilfe, Segnen, Wunden heilen und Geringere Wiederherstellung dauerhaft vorbereitet; auf höheren Stufen kommen weitere Zauber der Domäne hinzu. Sie zählen nicht gegen die Zahl deiner vorbereiteten Zauber.",
          },
          {
            name: "Leben bewahren",
            level: 3,
            description:
              "Als Magieaktion und Anwendung von Göttlicher Kanal verteilst du Heilung in Höhe des Fünffachen deiner Klerikerstufe frei auf angeschlagene Kreaturen in 9 Metern — dich eingeschlossen. Kein Ziel darf dabei über die Hälfte seiner maximalen Trefferpunkte gebracht werden.",
          },
        ],
      },
    ],
    startingEquipment: [
      {
        key: "a",
        label: "A — Kettenhemd, Schild und Streitkolben",
        gold: 7,
        items: [
          { name: "Kettenhemd", quantity: 1 },
          { name: "Schild", quantity: 1 },
          { name: "Streitkolben", quantity: 1 },
          { name: "Heiliges Symbol", quantity: 1 },
          { name: "Priesterpaket", quantity: 1 },
        ],
      },
    ],
    startingGoldAlternative: 110,
    roleTags: ["Heilung", "Unterstützung", "Nahkampf", "Anführer"],
    complexity: 2,
    art: "/character-creator/classes/kleriker.svg",
  },
];
