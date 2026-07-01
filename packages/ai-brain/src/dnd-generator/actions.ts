import type { DndContextDescriptor, DndGeneratorAction, DndGeneratorActionId } from "./types";

const BASE_ACTIONS: DndGeneratorAction[] = [
  {
    id: "summarize",
    label: "Zusammenfassen",
    description: "Kurze DM-Zusammenfassung des aktuellen Kontexts.",
    taskType: "summarize_page",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "player_version",
    label: "Spieler-Version erzeugen",
    description: "Spieler-sichere Fassung ohne DM-only-Inhalte.",
    taskType: "generate_player_recap",
    playerSafe: true,
    requiresReview: true,
  },
  {
    id: "dm_notes",
    label: "DM-Notizen erzeugen",
    description: "Erweiterte Spielleiter-Notizen und Vorbereitungshinweise.",
    taskType: "improve_lore_text",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "extract_brain_facts",
    label: "Brain-Fakten extrahieren",
    description: "Strukturierte Kanon-Fakten als Brain-Vorschlag.",
    brainActionId: "expand_knowledge",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "create_knowledge_text",
    label: "Wissenstext erstellen",
    description: "Strukturierten Wissenstext als neues Brain-Dokument vorschlagen.",
    taskType: "create_knowledge_text",
    brainActionId: "create_knowledge_text",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "canon_check",
    label: "Kanon-Konflikte prüfen",
    description: "Widersprüche und Kanon-Abweichungen erkennen.",
    taskType: "prepare_canon_check",
    brainActionId: "canon_check",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "prepare_next_session",
    label: "Nächste Session vorbereiten",
    description:
      "Regelbasierte Outline aus Session-Metadaten (ohne KI-Modell): Agenda, Szenen, NPCs, Encounter-Platzhalter und Handout-Ideen als Review-Vorschlag.",
    taskType: "prepare_next_session",
    brainActionId: "next_session_prep",
    playerSafe: false,
    requiresSession: true,
    requiresReview: true,
  },
  {
    id: "fill_missing",
    label: "Fehlende Inhalte ergänzen",
    description: "Gezielt fehlende Felder im aktuellen Kontext ergänzen.",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "create_handout",
    label: "Handout erzeugen",
    description: "Spieler-Handout ohne GM-Geheimnisse.",
    taskType: "create_player_handout",
    brainActionId: "player_handout",
    playerSafe: true,
    requiresReview: true,
  },
  {
    id: "create_label",
    label: "Label erzeugen",
    description: "6×4-Label-Text und Druckhinweise vorschlagen.",
    playerSafe: false,
    requiresReview: true,
  },
  {
    id: "image_prompt",
    label: "Bildprompt erzeugen",
    description: "Bildprompt für Karten, NPCs oder Szenen.",
    playerSafe: false,
    requiresReview: true,
  },
];

const CONTEXT_ACTION_IDS: Partial<Record<DndContextDescriptor["kind"], DndGeneratorActionId[]>> = {
  world: [
    "summarize",
    "canon_check",
    "prepare_next_session",
    "extract_brain_facts",
    "create_knowledge_text",
  ],
  page: [
    "summarize",
    "player_version",
    "dm_notes",
    "canon_check",
    "fill_missing",
    "create_knowledge_text",
    "image_prompt",
  ],
  npc: [
    "summarize",
    "dm_notes",
    "fill_missing",
    "canon_check",
    "create_handout",
    "create_knowledge_text",
    "image_prompt",
    "extract_brain_facts",
  ],
  location: [
    "summarize",
    "dm_notes",
    "fill_missing",
    "canon_check",
    "create_handout",
    "image_prompt",
    "create_knowledge_text",
  ],
  faction: [
    "summarize",
    "dm_notes",
    "fill_missing",
    "canon_check",
    "extract_brain_facts",
    "create_knowledge_text",
  ],
  quest: ["summarize", "dm_notes", "fill_missing", "canon_check", "create_handout"],
  session: [
    "summarize",
    "player_version",
    "dm_notes",
    "prepare_next_session",
    "fill_missing",
    "create_handout",
    "canon_check",
  ],
  dungeon: ["summarize", "dm_notes", "fill_missing", "canon_check", "create_label", "image_prompt"],
  dungeon_level: ["summarize", "dm_notes", "fill_missing", "canon_check", "create_label"],
  room: [
    "summarize",
    "dm_notes",
    "fill_missing",
    "canon_check",
    "create_handout",
    "create_label",
    "image_prompt",
  ],
  encounter: [
    "summarize",
    "dm_notes",
    "fill_missing",
    "create_handout",
    "create_label",
    "image_prompt",
  ],
  puzzle: ["summarize", "dm_notes", "fill_missing", "create_handout", "create_label"],
  trap: ["summarize", "dm_notes", "fill_missing", "create_label"],
  loot: ["summarize", "dm_notes", "fill_missing", "create_handout", "create_label"],
  handout: ["summarize", "player_version", "fill_missing", "create_label"],
  monster: ["summarize", "dm_notes", "fill_missing", "image_prompt", "create_label"],
  rule: ["summarize", "dm_notes", "canon_check", "extract_brain_facts", "create_knowledge_text"],
  workshop_project: ["summarize", "dm_notes", "canon_check", "fill_missing", "image_prompt"],
};

function actionById(id: DndGeneratorActionId): DndGeneratorAction | undefined {
  return BASE_ACTIONS.find((action) => action.id === id);
}

export function listActionsForContext(context: DndContextDescriptor): DndGeneratorAction[] {
  const ids = CONTEXT_ACTION_IDS[context.kind] ?? [
    "summarize",
    "dm_notes",
    "canon_check",
    "fill_missing",
  ];

  const actions = ids
    .map((id) => actionById(id))
    .filter((action): action is DndGeneratorAction => Boolean(action));

  if (context.kind === "room" || context.kind === "dungeon_level" || context.kind === "dungeon") {
    const fillRoom = {
      id: "fill_missing" as const,
      label: "Dungeonraum füllen",
      description: "Raumbeschreibung, Interaktionen und GM-Notizen ergänzen.",
      taskType: "fill_dungeon_room" as const,
      brainActionId: "fill_dungeon_room",
      playerSafe: false,
      requiresReview: true as const,
    };
    const idx = actions.findIndex((a) => a.id === "fill_missing");
    if (idx >= 0) {
      actions[idx] = fillRoom;
    }
  }

  return actions;
}

export function resolveBrainActionId(action: DndGeneratorAction): string | null {
  return action.brainActionId ?? null;
}

export function resolveTaskType(action: DndGeneratorAction): string | null {
  return action.taskType ?? null;
}
