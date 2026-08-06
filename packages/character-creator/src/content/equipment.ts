/**
 * Ausrüstung: die sieben Standardpakete, die Waffentabelle und die Rüstungstabelle.
 *
 * Herkunft: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast), Regeln von 2024.
 * Inhalte, Preise und Gewichte sind 1:1 aus dem SRD übernommen; die deutschen
 * Namen sind UWEs eigene Übersetzung, denn ein deutsches SRD gibt es nicht.
 * `nameEn` an den Paketen hält den Originalnamen für den Abgleich fest.
 *
 * Drei Konventionen, die diese Datei durchhält:
 * - **Geld in Kupfermünzen.** `valueCp` ist die einzige Werteinheit; 1 GM =
 *   100 KM, 1 SM = 10 KM. Die Oberfläche formatiert daraus, was lesbar ist.
 *   Nur `EquipmentPack.costGp` ist Gold, weil der Typ das so vorgibt.
 * - **Gewicht in Pfund**, wie `EquipmentLine.weight` es vorschreibt. Die
 *   Schleuder hat im SRD kein Gewicht — dort steht `null`, nicht 0.
 * - **Entfernungen in Metern** (1,5 m je 5 Fuß), wie im übrigen Katalog.
 *
 * Die Meisterschaftseigenschaft jeder Waffe steht mit ihrem englischen
 * SRD-Namen in den Notizen (`Meisterschaft: Vex`). Das ist Absicht: Für die
 * 2024er Meisterschaften existiert keine belegbare deutsche Fassung, und ein
 * erfundener Name wäre schlechter als der nachschlagbare Originalbegriff.
 */

import { SRD_SOURCE, type EquipmentLine, type EquipmentPack } from "../types";

/** Eine Zeile im Paketinhalt — Menge zählt, Preis und Gewicht stehen am Paket. */
function item(name: string, quantity = 1, notes?: string): EquipmentLine {
  return notes === undefined ? { name, quantity } : { name, quantity, notes };
}

/** Eine Zeile in der Waffen- oder Rüstungstabelle. */
function gear(name: string, weight: number | null, valueCp: number, notes: string): EquipmentLine {
  return { name, quantity: 1, weight, valueCp, notes };
}

/**
 * Die sieben Ausrüstungspakete des SRD.
 *
 * Klassen und Hintergründe verweisen über den deutschen Namen darauf
 * (`{ name: "Entdeckerpaket", quantity: 1 }`), deshalb müssen die Namen hier
 * und in den Klassendateien wörtlich übereinstimmen.
 */
export const EQUIPMENT_PACKS: EquipmentPack[] = [
  {
    key: "einbrecherpaket",
    name: "Einbrecherpaket",
    nameEn: "Burglar's Pack",
    hook: "Alles, was man braucht, um leise irgendwo hineinzukommen und wieder heraus.",
    description:
      "Das teuerste der leichten Pakete und das einzige mit Kugellager und Glocke — Werkzeug, um Verfolger aufzuhalten und Fallen auszulösen, ohne selbst hinzugehen. Die abgedeckte Laterne lässt sich mit einem Handgriff verdunkeln, was sie der offenen Fackel überlegen macht, wenn niemand das Licht sehen soll.",
    source: SRD_SOURCE,
    costGp: 16,
    items: [
      item("Rucksack"),
      item("Kugellager", 1, "Beutel mit 1.000 Stück"),
      item("Glocke"),
      item("Kerze", 10),
      item("Brecheisen"),
      item("Kapuzenlaterne"),
      item("Öl", 7, "Fläschchen"),
      item("Rationen", 5, "Tagesrationen"),
      item("Seil"),
      item("Zunderkästchen"),
      item("Wasserschlauch"),
    ],
  },
  {
    key: "diplomatenpaket",
    name: "Diplomatenpaket",
    nameEn: "Diplomat's Pack",
    hook: "Für Verhandlungen statt Verliese: Schreibzeug, feine Kleidung, eine Truhe.",
    description:
      "Kein Stück davon hilft im Kampf, jedes davon in einem Audienzsaal. Tinte, Federn, Papier und Pergament reichen für Verträge und Empfehlungsschreiben, die Behälter schützen Karten und Schriftrollen auf der Reise, und feine Kleidung ist an manchen Höfen die Eintrittskarte.",
    source: SRD_SOURCE,
    costGp: 39,
    items: [
      item("Truhe"),
      item("Feine Kleidung"),
      item("Tinte", 1, "Fläschchen"),
      item("Schreibfeder", 5),
      item("Lampe"),
      item("Karten- oder Schriftrollenbehälter", 2),
      item("Öl", 4, "Fläschchen"),
      item("Papier", 5, "Bögen"),
      item("Pergament", 5, "Bögen"),
      item("Parfüm"),
      item("Zunderkästchen"),
    ],
  },
  {
    key: "hoehlenforscherpaket",
    name: "Höhlenforscherpaket",
    nameEn: "Dungeoneer's Pack",
    hook: "Das Paket für unter Tage: Licht, Seil, Brecheisen und zehn Tage Verpflegung.",
    description:
      "Der Unterschied zum Entdeckerpaket sind Krähenfüße und Brecheisen — Werkzeug für enge Gänge, verschlossene Türen und Verfolger im Rücken. Zehn Fackeln und zehn Tagesrationen decken einen längeren Abstieg ab, ohne dass jemand zum Nachschub zurückmuss.",
    source: SRD_SOURCE,
    costGp: 12,
    items: [
      item("Rucksack"),
      item("Krähenfüße", 1, "Beutel mit 20 Stück"),
      item("Brecheisen"),
      item("Öl", 2, "Fläschchen"),
      item("Rationen", 10, "Tagesrationen"),
      item("Seil"),
      item("Zunderkästchen"),
      item("Fackel", 10),
      item("Wasserschlauch"),
    ],
  },
  {
    key: "unterhalterpaket",
    name: "Unterhalterpaket",
    nameEn: "Entertainer's Pack",
    hook: "Drei Kostüme, ein Spiegel, eine Blendlaterne — die Ausrüstung für einen Auftritt.",
    description:
      "Das Paket rüstet die Bühne aus, nicht den Kampf: Kostüme für Rollen und Verkleidungen, ein Spiegel fürs Schminken, eine Blendlaterne als Scheinwerfer. Neun Tagesrationen und Schlafrolle machen daraus trotzdem ein reisetaugliches Gepäck.",
    source: SRD_SOURCE,
    costGp: 40,
    items: [
      item("Rucksack"),
      item("Schlafrolle"),
      item("Glocke"),
      item("Blendlaterne"),
      item("Kostüm", 3),
      item("Spiegel"),
      item("Öl", 8, "Fläschchen"),
      item("Rationen", 9, "Tagesrationen"),
      item("Zunderkästchen"),
      item("Wasserschlauch"),
    ],
  },
  {
    key: "entdeckerpaket",
    name: "Entdeckerpaket",
    nameEn: "Explorer's Pack",
    hook: "Das billigste Reisepaket und die häufigste Wahl: schlafen, sehen, essen, klettern.",
    description:
      "Zehn Goldmünzen für alles, was eine Gruppe zwei Wochen im Freien am Leben hält — Schlafrolle, Seil, Zunderkästchen, zehn Fackeln und zehn Tagesrationen. Wer nicht weiß, was ihn erwartet, nimmt dieses Paket.",
    source: SRD_SOURCE,
    costGp: 10,
    items: [
      item("Rucksack"),
      item("Schlafrolle"),
      item("Öl", 2, "Fläschchen"),
      item("Rationen", 10, "Tagesrationen"),
      item("Seil"),
      item("Zunderkästchen"),
      item("Fackel", 10),
      item("Wasserschlauch"),
    ],
  },
  {
    key: "priesterpaket",
    name: "Priesterpaket",
    nameEn: "Priest's Pack",
    hook: "Robe, Decke, Weihwasser — Ausrüstung für Zeremonien statt für Höhlen.",
    description:
      "Das schmalste der teuren Pakete: Der Preis steckt fast ganz im Weihwasser, das gegen Untote und Unholde zählt. Robe und Lampe gehören zur Zeremonie, sieben Tagesrationen und eine Decke zum Weg dorthin. Ein Seil ist nicht dabei.",
    source: SRD_SOURCE,
    costGp: 33,
    items: [
      item("Rucksack"),
      item("Decke"),
      item("Weihwasser", 1, "Phiole"),
      item("Lampe"),
      item("Rationen", 7, "Tagesrationen"),
      item("Robe"),
      item("Zunderkästchen"),
    ],
  },
  {
    key: "gelehrtenpaket",
    name: "Gelehrtenpaket",
    nameEn: "Scholar's Pack",
    hook: "Buch, Tinte, Pergament und zehn Fläschchen Öl — Licht zum Lesen, nicht zum Kämpfen.",
    description:
      "Ein Arbeitsplatz zum Mitnehmen. Zehn Fläschchen Lampenöl reichen für lange Nächte über einem Buch, zehn Bögen Pergament für alles, was dabei herauskommt. Verpflegung, Seil und Schlafrolle fehlen — dieses Paket rechnet mit einem Dach über dem Kopf.",
    source: SRD_SOURCE,
    costGp: 40,
    items: [
      item("Rucksack"),
      item("Buch"),
      item("Tinte", 1, "Fläschchen"),
      item("Schreibfeder"),
      item("Lampe"),
      item("Öl", 10, "Fläschchen"),
      item("Pergament", 10, "Bögen"),
      item("Zunderkästchen"),
    ],
  },
];

/**
 * Die vollständige Waffentabelle des SRD, in der Reihenfolge der Quelle:
 * einfache Nahkampfwaffen, einfache Fernkampfwaffen, Kriegsnahkampfwaffen,
 * Kriegsfernkampfwaffen. Die Notiz trägt Schaden, Eigenschaften und
 * Meisterschaft; die Kategorie steht darin am Anfang nicht — sie ergibt sich
 * aus der Waffenübung der Klasse und wäre hier doppelte Wahrheit.
 */
export const WEAPONS: EquipmentLine[] = [
  // Einfache Nahkampfwaffen
  gear("Keule", 2, 10, "1W4 Wucht, Leicht; Meisterschaft: Slow"),
  gear("Dolch", 1, 200, "1W4 Stich, Finesse, Leicht, Wurfwaffe (6/18 m); Meisterschaft: Nick"),
  gear("Großkeule", 10, 20, "1W8 Wucht, Zweihändig; Meisterschaft: Push"),
  gear("Handaxt", 2, 500, "1W6 Hieb, Leicht, Wurfwaffe (6/18 m); Meisterschaft: Vex"),
  gear("Wurfspeer", 2, 50, "1W6 Stich, Wurfwaffe (9/36 m); Meisterschaft: Slow"),
  gear("Leichter Hammer", 2, 200, "1W4 Wucht, Leicht, Wurfwaffe (6/18 m); Meisterschaft: Nick"),
  gear("Streitkolben", 4, 500, "1W6 Wucht; Meisterschaft: Sap"),
  gear("Kampfstab", 4, 20, "1W6 Wucht, Vielseitig (1W8); Meisterschaft: Topple"),
  gear("Sichel", 2, 100, "1W4 Hieb, Leicht; Meisterschaft: Nick"),
  gear("Speer", 3, 100, "1W6 Stich, Wurfwaffe (6/18 m), Vielseitig (1W8); Meisterschaft: Sap"),
  // Einfache Fernkampfwaffen
  gear("Wurfpfeil", 0.25, 5, "1W4 Stich, Finesse, Wurfwaffe (6/18 m); Meisterschaft: Vex"),
  gear("Leichte Armbrust", 5, 2500, "1W8 Stich, Munition (24/96 m, Bolzen), Nachladen, Zweihändig; Meisterschaft: Slow"),
  gear("Kurzbogen", 2, 2500, "1W6 Stich, Munition (24/96 m, Pfeil), Zweihändig; Meisterschaft: Vex"),
  gear("Schleuder", null, 10, "1W4 Wucht, Munition (9/36 m, Kugel); Meisterschaft: Slow"),
  // Kriegsnahkampfwaffen
  gear("Streitaxt", 4, 1000, "1W8 Hieb, Vielseitig (1W10); Meisterschaft: Topple"),
  gear("Kriegsflegel", 2, 1000, "1W8 Wucht; Meisterschaft: Sap"),
  gear("Glefe", 6, 2000, "1W10 Hieb, Schwer, Reichweite, Zweihändig; Meisterschaft: Graze"),
  gear("Großaxt", 7, 3000, "1W12 Hieb, Schwer, Zweihändig; Meisterschaft: Cleave"),
  gear("Großschwert", 6, 5000, "2W6 Hieb, Schwer, Zweihändig; Meisterschaft: Graze"),
  gear("Hellebarde", 6, 2000, "1W10 Hieb, Schwer, Reichweite, Zweihändig; Meisterschaft: Cleave"),
  gear("Lanze", 6, 1000, "1W10 Stich, Schwer, Reichweite, Zweihändig (außer beritten); Meisterschaft: Topple"),
  gear("Langschwert", 3, 1500, "1W8 Hieb, Vielseitig (1W10); Meisterschaft: Sap"),
  gear("Schlägel", 10, 1000, "2W6 Wucht, Schwer, Zweihändig; Meisterschaft: Topple"),
  gear("Morgenstern", 4, 1500, "1W8 Stich; Meisterschaft: Sap"),
  gear("Pike", 18, 500, "1W10 Stich, Schwer, Reichweite, Zweihändig; Meisterschaft: Push"),
  gear("Rapier", 2, 2500, "1W8 Stich, Finesse; Meisterschaft: Vex"),
  gear("Krummsäbel", 3, 2500, "1W6 Hieb, Finesse, Leicht; Meisterschaft: Nick"),
  gear("Kurzschwert", 2, 1000, "1W6 Stich, Finesse, Leicht; Meisterschaft: Vex"),
  gear("Dreizack", 4, 500, "1W8 Stich, Wurfwaffe (6/18 m), Vielseitig (1W10); Meisterschaft: Topple"),
  gear("Kriegshammer", 5, 1500, "1W8 Wucht, Vielseitig (1W10); Meisterschaft: Push"),
  gear("Kriegspickel", 2, 500, "1W8 Stich, Vielseitig (1W10); Meisterschaft: Sap"),
  gear("Peitsche", 3, 200, "1W4 Hieb, Finesse, Reichweite; Meisterschaft: Slow"),
  // Kriegsfernkampfwaffen
  gear("Blasrohr", 1, 1000, "1 Stich, Munition (7,5/30 m, Nadel), Nachladen; Meisterschaft: Vex"),
  gear("Handarmbrust", 3, 7500, "1W6 Stich, Munition (9/36 m, Bolzen), Leicht, Nachladen; Meisterschaft: Vex"),
  gear("Schwere Armbrust", 18, 5000, "1W10 Stich, Munition (30/120 m, Bolzen), Schwer, Nachladen, Zweihändig; Meisterschaft: Push"),
  gear("Langbogen", 2, 5000, "1W8 Stich, Munition (45/180 m, Pfeil), Schwer, Zweihändig; Meisterschaft: Slow"),
  gear("Muskete", 10, 50000, "1W12 Stich, Munition (12/36 m, Kugel), Nachladen, Zweihändig; Meisterschaft: Slow"),
  gear("Pistole", 3, 25000, "1W10 Stich, Munition (9/27 m, Kugel), Nachladen; Meisterschaft: Vex"),
];

/**
 * Die Rüstungstabelle des SRD samt Schild.
 *
 * Die Notiz nennt Kategorie und Rüstungsklasse, weil beides zusammen die
 * Entscheidung trägt: „RK 14 + GE-Mod (max. +2)" ist für einen Charakter mit
 * hoher Geschicklichkeit etwas anderes als für einen mit hoher Stärke. Die
 * Stärkeanforderung schwerer Rüstung senkt die Bewegungsrate um 3 Meter,
 * wenn sie nicht erfüllt ist — sie ist kein Trageverbot.
 */
export const ARMOR: EquipmentLine[] = [
  // Leichte Rüstung — 1 Minute zum An- und Ablegen
  gear("Gepolsterte Rüstung", 8, 500, "Leicht, RK 11 + GE-Mod, Nachteil auf Heimlichkeit"),
  gear("Lederrüstung", 10, 1000, "Leicht, RK 11 + GE-Mod"),
  gear("Beschlagene Lederrüstung", 13, 4500, "Leicht, RK 12 + GE-Mod"),
  // Mittelschwere Rüstung — 5 Minuten anlegen, 1 Minute ablegen
  gear("Fellrüstung", 12, 1000, "Mittelschwer, RK 12 + GE-Mod (max. +2)"),
  gear("Kettenhemd", 20, 5000, "Mittelschwer, RK 13 + GE-Mod (max. +2)"),
  gear("Schuppenpanzer", 45, 5000, "Mittelschwer, RK 14 + GE-Mod (max. +2), Nachteil auf Heimlichkeit"),
  gear("Brustplatte", 20, 40000, "Mittelschwer, RK 14 + GE-Mod (max. +2)"),
  gear("Halbplattenrüstung", 40, 75000, "Mittelschwer, RK 15 + GE-Mod (max. +2), Nachteil auf Heimlichkeit"),
  // Schwere Rüstung — 10 Minuten anlegen, 5 Minuten ablegen
  gear("Ringpanzer", 40, 3000, "Schwer, RK 14, Nachteil auf Heimlichkeit"),
  gear("Kettenrüstung", 55, 7500, "Schwer, RK 16, ab ST 13 ohne Bewegungsabzug, Nachteil auf Heimlichkeit"),
  gear("Schienenrüstung", 60, 20000, "Schwer, RK 17, ab ST 15 ohne Bewegungsabzug, Nachteil auf Heimlichkeit"),
  gear("Plattenrüstung", 65, 150000, "Schwer, RK 18, ab ST 15 ohne Bewegungsabzug, Nachteil auf Heimlichkeit"),
  // Schild — mit einer Nutzen-Aktion an- oder abgelegt
  gear("Schild", 6, 1000, "Schild, +2 RK"),
];
