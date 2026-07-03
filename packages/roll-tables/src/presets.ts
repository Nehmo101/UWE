import type { RollTableCategory, RollTableEntry } from "./roll";

export interface RollTablePreset {
  key: string;
  name: string;
  category: RollTableCategory;
  dice?: string;
  notes?: string;
  entries: RollTableEntry[];
}

/** Startpaket an Tabellen — pro Welt einmalig einspielbar, danach frei editierbar. */
export const ROLL_TABLE_PRESETS: RollTablePreset[] = [
  {
    key: "loot-common",
    name: "Loot — Kleinkram & Kuriositäten",
    category: "loot",
    dice: "d20",
    notes: "Für Taschen, Kisten und besiegte Gegner niedriger Stufe.",
    entries: [
      { label: "Beutel mit 2W6 Silbermünzen", weight: 3 },
      { label: "Beutel mit 1W6 Goldmünzen", weight: 2 },
      { label: "Verschlissene Karte mit unbekannter Markierung" },
      { label: "Kleiner Heiltrank (2W4+2)", weight: 2 },
      { label: "Glücksbringer aus Knochen" },
      { label: "Rostiger Dolch mit eingraviertem Namen" },
      { label: "Fläschchen Lampenöl" },
      { label: "Handvoll seltsam warmer Kieselsteine" },
      { label: "Liebesbrief an eine unbekannte Person" },
      { label: "Würfelset aus Zähnen" },
      { label: "Silberring (5 GM wert)" },
      { label: "Schlüssel ohne bekanntes Schloss" },
    ],
  },
  {
    key: "loot-rare",
    name: "Loot — Wertvolles & Magisches",
    category: "loot",
    dice: "d12",
    notes: "Für Bosstruhen und Questbelohnungen — Werte vor Vergabe prüfen.",
    entries: [
      { label: "Trank der Riesenstärke (1 Anwendung)" },
      { label: "Schriftrolle mit Zauber des 2. Grades" },
      { label: "Edelstein (50 GM)", weight: 3 },
      { label: "+1-Waffe nach Wahl des DM" },
      { label: "Umhang mit schwacher Illusionsaura" },
      { label: "Amulett — schützt 1× vor Todesstoß" },
      { label: "Beutel mit 3W6 × 10 Goldmünzen", weight: 2 },
      { label: "Karte zu einem versteckten Lager" },
    ],
  },
  {
    key: "encounter-wilderness",
    name: "Zufalls-Encounter — Wildnis",
    category: "encounter",
    dice: "d10",
    entries: [
      { label: "Wolfsrudel umkreist das Lager", weight: 2 },
      { label: "Fahrender Händler mit merkwürdiger Ware", weight: 2 },
      { label: "Banditen fordern Wegzoll", weight: 2 },
      { label: "Verletzter Bote mit dringender Nachricht" },
      { label: "Spuren eines großen Raubtiers" },
      { label: "Umgestürzter Karren, Besitzer verschwunden" },
      { label: "Patrouille der lokalen Herrschaft" },
      { label: "Unwetter zwingt zur Rast an ungünstigem Ort" },
    ],
  },
  {
    key: "encounter-dungeon",
    name: "Zufalls-Encounter — Dungeon",
    category: "encounter",
    dice: "d8",
    entries: [
      { label: "Patrouille der Dungeon-Bewohner", weight: 2 },
      { label: "Einsturz blockiert den Rückweg" },
      { label: "Verirrter Abenteurer — Freund oder Köder?" },
      { label: "Fallengang: Bodenplatte klickt" },
      { label: "Nest kleiner Kreaturen (Schwarm)" },
      { label: "Seltsames Echo — etwas imitiert Stimmen" },
      { label: "Alte Vorratskammer mit brauchbarem Loot" },
      { label: "Ritualplatz, noch warm" },
    ],
  },
  {
    key: "names-tavern",
    name: "Namen — Tavernen & Gasthäuser",
    category: "names",
    dice: "d10",
    entries: [
      { label: "Zum Tanzenden Greif" },
      { label: "Der Rostige Anker" },
      { label: "Zur Singenden Klinge" },
      { label: "Das Lachende Fass" },
      { label: "Zum Schielenden Kobold" },
      { label: "Die Goldene Rübe" },
      { label: "Zum Letzten Heller" },
      { label: "Der Schlafende Drache" },
      { label: "Zur Krummen Laterne" },
      { label: "Das Flüsternde Schwein" },
    ],
  },
  {
    key: "names-npc",
    name: "Namen — NPCs (gemischt)",
    category: "names",
    dice: "d20",
    entries: [
      { label: "Berrik Eisenhand" },
      { label: "Mara Distelfeld" },
      { label: "Thalen von Grauwacht" },
      { label: "Isra Nachtwind" },
      { label: "Oswin Kupferbart" },
      { label: "Lyra Morgentau" },
      { label: "Gundar Splitterzahn" },
      { label: "Elenya Sturmlied" },
      { label: "Corvin Aschenherz" },
      { label: "Nessa Dornenkranz" },
      { label: "Falk Winterkorn" },
      { label: "Sable Rußfinger" },
    ],
  },
];
