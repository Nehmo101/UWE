import type { DndContextKind, GeneratorPreset } from "./types";

const PRESETS: GeneratorPreset[] = [
  {
    id: "npc_default",
    label: "NPC — Standard",
    contextKind: "npc",
    description: "Rolle, Motivation, Hooks und Spielhinweise.",
    templateHint: "Name, Rolle, Motivation, Geheimnis, Hooks",
  },
  {
    id: "location_default",
    label: "Ort — Standard",
    contextKind: "location",
    description: "Atmosphäre, NPCs, Geheimnisse und Abenteuer-Hooks.",
    templateHint: "Atmosphäre, Bewohner, Geheimnis, Hooks",
  },
  {
    id: "faction_default",
    label: "Fraktion — Standard",
    contextKind: "faction",
    description: "Ziele, Struktur, Schlüsselfiguren und Konflikte.",
    templateHint: "Ziele, Hierarchie, Schlüssel-NPCs, Konflikte",
  },
  {
    id: "quest_default",
    label: "Quest — Standard",
    contextKind: "quest",
    description: "Auftrag, Belohnung, Komplikationen und Folgen.",
    templateHint: "Auftrag, Belohnung, Komplikationen, Folgen",
  },
  {
    id: "session_default",
    label: "Session — Standard",
    contextKind: "session",
    description: "Agenda, Szenen und Vorbereitung.",
    templateHint: "Agenda, Szenen, NPCs, Encounters",
  },
  {
    id: "dungeon_default",
    label: "Dungeon — Standard",
    contextKind: "dungeon",
    description: "Thema, Ebenen, Gefahren und Belohnungen.",
    templateHint: "Thema, Ebenen, Gefahren, Belohnungen",
  },
  {
    id: "dungeon_level_default",
    label: "Dungeon-Ebene — Standard",
    contextKind: "dungeon_level",
    description: "Layout, Atmosphäre und Verbindungen.",
    templateHint: "Layout, Atmosphäre, Verbindungen, Räume",
  },
  {
    id: "room_default",
    label: "Raum — Standard",
    contextKind: "room",
    description: "Beschreibung, Interaktionen, Gefahren und Loot.",
    templateHint: "Vorlesetext, Spieler-Beschreibung, DM-Notizen, Interaktionen",
  },
  {
    id: "encounter_default",
    label: "Encounter — Standard",
    contextKind: "encounter",
    description: "Gegner, Taktik, Terrain und Konsequenzen.",
    templateHint: "Gegner, Taktik, Terrain, Scaling, Loot, Konsequenzen",
  },
  {
    id: "puzzle_default",
    label: "Rätsel — Standard",
    contextKind: "puzzle",
    description: "Setup, Hinweise, Lösung und Alternativen.",
    templateHint: "Setup, Hinweise, Lösung, Fehlschläge",
  },
  {
    id: "trap_default",
    label: "Falle — Standard",
    contextKind: "trap",
    description: "Auslöser, Effekt, Wahrnehmung und Umgehung.",
    templateHint: "Auslöser, Effekt, Wahrnehmung, Umgehung",
  },
  {
    id: "loot_default",
    label: "Loot — Standard",
    contextKind: "loot",
    description: "Gegenstände, Wert und narrative Hooks.",
    templateHint: "Gegenstände, Wert, Hooks, Versteck",
  },
  {
    id: "handout_default",
    label: "Handout — Standard",
    contextKind: "handout",
    description: "Spieler-sicheres In-Game-Dokument.",
    templateHint: "Spielertext, Format, keine GM-Geheimnisse",
  },
  {
    id: "monster_default",
    label: "Monster — Standard",
    contextKind: "monster",
    description: "Verhalten, Taktik und Besonderheiten.",
    templateHint: "Verhalten, Taktik, Besonderheiten, Loot",
  },
  {
    id: "rule_default",
    label: "Regel — Standard",
    contextKind: "rule",
    description: "Hausregel oder Setting-Regel klar formulieren.",
    templateHint: "Regel, Begründung, Beispiele, Ausnahmen",
  },
];

export function listPresetsForContextKind(kind: DndContextKind): GeneratorPreset[] {
  if (kind === "page" || kind === "world" || kind === "workshop_project") {
    return PRESETS.filter((preset) => preset.contextKind === "npc" || preset.contextKind === "location");
  }
  return PRESETS.filter((preset) => preset.contextKind === kind);
}

export function getPresetById(id: string): GeneratorPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
