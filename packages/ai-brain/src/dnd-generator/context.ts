import type { DndContextDescriptor, DndContextKind } from "./types";

const PAGE_TYPE_TO_KIND: Record<string, DndContextKind> = {
  npc: "npc",
  location: "location",
  region: "location",
  faction: "faction",
  quest: "quest",
  session: "session",
  dungeon: "dungeon",
  dungeon_level: "dungeon_level",
  room: "room",
  encounter: "encounter",
  puzzle: "puzzle",
  trap: "trap",
  loot: "loot",
  handout: "handout",
  monster: "monster",
  rule: "rule",
  lore: "page",
  item: "page",
  secret: "page",
  map: "page",
  note: "page",
  player_character: "page",
  sound: "page",
};

export function pageTypeToContextKind(pageType: string): DndContextKind {
  return PAGE_TYPE_TO_KIND[pageType] ?? "page";
}

export function buildPageContext(input: {
  worldSlug: string;
  worldId?: string;
  pageSlug: string;
  pageId?: string;
  pageType: string;
  title: string;
}): DndContextDescriptor {
  return {
    kind: pageTypeToContextKind(input.pageType),
    worldSlug: input.worldSlug,
    worldId: input.worldId,
    pageSlug: input.pageSlug,
    pageId: input.pageId,
    pageType: input.pageType,
    title: input.title,
  };
}

export function buildSessionContext(input: {
  worldSlug: string;
  worldId?: string;
  sessionId: string;
  title: string;
}): DndContextDescriptor {
  return {
    kind: "session",
    worldSlug: input.worldSlug,
    worldId: input.worldId,
    sessionId: input.sessionId,
    title: input.title,
  };
}

export function buildDungeonRoomContext(input: {
  worldSlug: string;
  worldId?: string;
  pageSlug: string;
  pageId?: string;
  title: string;
  dungeonSlug: string;
  levelSlug: string;
  roomSlug: string;
}): DndContextDescriptor {
  return {
    kind: "room",
    worldSlug: input.worldSlug,
    worldId: input.worldId,
    pageSlug: input.pageSlug,
    pageId: input.pageId,
    pageType: "room",
    title: input.title,
    dungeonSlug: input.dungeonSlug,
    levelSlug: input.levelSlug,
    roomSlug: input.roomSlug,
  };
}

export function buildWorkshopProjectContext(input: {
  worldSlug: string;
  worldId?: string;
  workshopProjectId: string;
  title: string;
  linkedPageSlug?: string;
  linkedPageId?: string;
}): DndContextDescriptor {
  return {
    kind: "workshop_project",
    worldSlug: input.worldSlug,
    worldId: input.worldId,
    workshopProjectId: input.workshopProjectId,
    title: input.title,
    pageSlug: input.linkedPageSlug,
    pageId: input.linkedPageId,
    pageType: "page",
  };
}

export function contextLabel(context: DndContextDescriptor): string {
  const labels: Record<DndContextKind, string> = {
    world: "Welt",
    page: "Seite",
    npc: "NPC",
    location: "Ort",
    faction: "Fraktion",
    quest: "Quest",
    session: "Session",
    dungeon: "Dungeon",
    dungeon_level: "Dungeon-Ebene",
    room: "Raum",
    encounter: "Encounter",
    puzzle: "Rätsel",
    trap: "Falle",
    loot: "Loot",
    handout: "Handout",
    monster: "Monster",
    rule: "Regel",
    workshop_project: "Werkstatt-Projekt",
  };
  return labels[context.kind] ?? "Kontext";
}
