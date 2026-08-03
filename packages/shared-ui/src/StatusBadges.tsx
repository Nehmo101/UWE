import type {
  AssetType,
  CanonicalStatus,
  ContentBlockType,
  DungeonPrepStatus,
  GameSessionStatus,
  PageType,
  QuestLifecycleStatus,
} from "@uwe/database/enums";

/** Shared shape for every status/type badge in this file. */
const BADGE_BASE =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * Semantic color tones reused across the badge components below. Each tone
 * ports the background/text/border intent of the former `.uwe-badge-*`
 * classes onto the shared token palette.
 */
const BADGE_TONE = {
  plain: "border-transparent",
  secret:
    "border-[color-mix(in_srgb,var(--uwe-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--uwe-danger)_15%,transparent)] text-destructive",
  danger:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-danger)_20%,transparent)] text-destructive",
  player:
    "border-[color-mix(in_srgb,var(--uwe-player-visible)_20%,transparent)] bg-[color-mix(in_srgb,var(--uwe-player-visible)_12%,transparent)] text-[var(--uwe-player-visible)]",
  public:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-info)_12%,transparent)] text-info",
  published:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] text-[color-mix(in_srgb,var(--uwe-accent)_35%,var(--uwe-fg)_65%)]",
  canon:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-accent)_12%,transparent)] text-[color-mix(in_srgb,var(--uwe-accent)_35%,var(--uwe-fg)_65%)]",
  draft:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-warning)_12%,transparent)] text-warning",
  warning:
    "border-transparent bg-[color-mix(in_srgb,var(--uwe-warning)_20%,transparent)] text-warning",
  type: "border-transparent bg-border text-foreground",
} as const;

/**
 * Freeform wiki tags carry no color in the data model, so give each a stable,
 * deterministic swatch color from the semantic palette — the Parchment-OS
 * "bunte Pünktchen" applied to tags.
 */
const TAG_SWATCHES = [
  "bg-[var(--uwe-success)]",
  "bg-[var(--uwe-warning)]",
  "bg-primary",
] as const;

function tagSwatchClass(tag: string): string {
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) >>> 0;
  }
  return TAG_SWATCHES[hash % TAG_SWATCHES.length];
}

/** A wiki tag/label chip with a colored square swatch. */
export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs bg-[color-mix(in_srgb,var(--uwe-accent)_15%,transparent)] text-[color-mix(in_srgb,var(--uwe-accent)_35%,var(--uwe-fg)_65%)]">
      <span className={`inline-block h-2 w-2 rounded-[2px] ${tagSwatchClass(tag)}`} aria-hidden />
      {tag}
    </span>
  );
}








export const CANONICAL_LABELS: Record<CanonicalStatus, string> = {
  idea: "Idee",
  draft: "Entwurf",
  prepared: "Vorbereitet",
  played: "Gespielt",
  canon: "Kanon",
  deprecated: "Veraltet",
  contradictory: "Widersprüchlich",
  non_canon: "Nicht kanonisch",
  discarded: "Verworfen",
};

export const CANONICAL_DESCRIPTIONS: Record<CanonicalStatus, string> = {
  idea: "Rohe Idee — noch nicht ausgearbeitet, kein etablierter Kanon.",
  draft: "In Bearbeitung — Inhalt wird ausformuliert, aber noch nicht am Tisch gespielt.",
  prepared: "Für die nächste Session vorbereitet — bereit zum Spielen.",
  played: "Am Tisch gespielt — Ereignis ist passiert, Kanon noch nicht finalisiert.",
  canon: "Etablierter Kanon — verbindliche Wahrheit der Kampagne.",
  deprecated: "Veraltet — durch neuere Kanon-Entwicklung überholt, aber noch referenzierbar.",
  contradictory: "Widersprüchlich — kollidiert mit etabliertem Kanon, Klärung nötig.",
  non_canon: "Nicht kanonisch — absichtlich außerhalb der Kampagnen-Wahrheit (What-If, Alt-Version).",
  discarded: "Verworfen — nicht mehr relevant, wird nicht weiterverfolgt.",
};

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  lore: "Lore",
  location: "Ort",
  region: "Region",
  npc: "NPC",
  faction: "Fraktion",
  item: "Gegenstand",
  dungeon: "Dungeon",
  dungeon_level: "Dungeon-Ebene",
  room: "Raum",
  encounter: "Begegnung",
  trap: "Falle",
  puzzle: "Rätsel",
  loot: "Loot",
  session: "Session",
  quest: "Quest",
  handout: "Handout",
  rule: "Regel",
  player_character: "Spielercharakter",
  monster: "Monster",
  sound: "Sound",
  map: "Karte",
  secret: "Geheimnis",
  note: "Notiz",
};

export const QUEST_STATUS_LABELS: Record<QuestLifecycleStatus, string> = {
  open: "Offen",
  completed: "Erledigt",
  failed: "Gescheitert",
};

export const QUEST_STATUS_DESCRIPTIONS: Record<QuestLifecycleStatus, string> = {
  open: "Quest ist offen — erscheint im Questlog unter „Offen“. Kein gesetzter Status zählt ebenfalls als offen.",
  completed: "Quest wurde erfolgreich abgeschlossen.",
  failed: "Quest ist gescheitert oder nicht mehr erfüllbar.",
};

export const DUNGEON_PREP_STATUS_LABELS: Record<DungeonPrepStatus, string> = {
  unprepared: "Unvorbereitet",
  ready: "Bereit",
  played: "Gespielt",
  skipped: "Übersprungen",
};

export const GAME_SESSION_STATUS_LABELS: Record<GameSessionStatus, string> = {
  planned: "Geplant",
  prepared: "Vorbereitet",
  played: "Gespielt",
  summarized: "Zusammengefasst",
  archived: "Archiviert",
};

export type PlayerNoteStatus =
  | "draft"
  | "visible_to_dm"
  | "accepted"
  | "hidden"
  | "deleted";

export const PLAYER_NOTE_STATUS_LABELS: Record<PlayerNoteStatus, string> = {
  draft: "Entwurf",
  visible_to_dm: "An GM gesendet",
  accepted: "Übernommen",
  hidden: "Verborgen",
  deleted: "Gelöscht",
};

export const BLOCK_TYPE_LABELS: Record<ContentBlockType, string> = {
  rich_text: "Rich Text",
  html: "HTML",
  image: "Bild",
  gallery: "Galerie",
  map: "Karte",
  handout: "Handout",
  sound: "Sound",
  relation: "Beziehung",
  timeline: "Timeline",
  statblock: "Statblock",
  player_text: "Spielertext",
  ai_summary: "KI-Zusammenfassung",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  image: "Bild",
  map: "Karte",
  handout: "Handout",
  document: "Dokument",
  audio: "Audio",
  video: "Video",
  other: "Sonstiges",
};


/** Shown after a page passed through the KI review workflow. */
export function AiReviewedBadge() {
  return (
    <span
      className={`${BADGE_BASE} ${BADGE_TONE.plain}`}
      title="Diese Seite wurde per KI-Review bearbeitet und freigegeben."
    >
      KI-Reviewd
    </span>
  );
}



export function CanonicalBadge({ status }: { status: CanonicalStatus }) {
  const className = `${BADGE_BASE} ${
    status === "canon"
      ? BADGE_TONE.canon
      : status === "played"
        ? BADGE_TONE.published
        : status === "prepared"
          ? BADGE_TONE.player
          : status === "idea" || status === "draft"
            ? BADGE_TONE.draft
            : status === "contradictory"
              ? BADGE_TONE.danger
              : status === "non_canon"
                ? BADGE_TONE.warning
                : BADGE_TONE.plain
  }`;

  return (
    <span
      className={className}
      title={CANONICAL_DESCRIPTIONS[status]}
      aria-label={`Kanon-Status: ${CANONICAL_LABELS[status]}. ${CANONICAL_DESCRIPTIONS[status]}`}
    >
      {CANONICAL_LABELS[status]}
    </span>
  );
}

export function PageTypeBadge({ type }: { type: PageType }) {
  return (
    <span className={`${BADGE_BASE} ${BADGE_TONE.type}`}>{PAGE_TYPE_LABELS[type]}</span>
  );
}

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <span className={`${BADGE_BASE} ${BADGE_TONE.type}`}>{ASSET_TYPE_LABELS[type]}</span>
  );
}

/** Connector / local-AI runtime state shown in the Maschinenraum status badge. */
export type EngineConnectorState = "online" | "offline" | "disabled" | "starting" | "error";

export const ENGINE_STATE_LABELS: Record<EngineConnectorState, string> = {
  online: "Maschinenraum online",
  offline: "Maschinenraum offline",
  disabled: "Maschinenraum deaktiviert",
  starting: "Maschinenraum startet",
  error: "Maschinenraum Fehler",
};

export const ENGINE_STATE_DESCRIPTIONS: Record<EngineConnectorState, string> = {
  online: "Maschinenraum verbunden — lokale KI ist verfügbar.",
  offline:
    "Maschinenraum nicht erreichbar. KI-Jobs werden vorgemerkt und starten automatisch, sobald der Maschinenraum wieder online ist — kein Cloud-Fallback.",
  disabled: "Maschinenraum deaktiviert. Aktiviere ihn, um lokale KI zu nutzen.",
  starting: "Maschinenraum wird gestartet — bitte kurz warten.",
  error: "Maschinenraum meldet einen Fehler. Prüfe den Systemstatus.",
};

/**
 * Die Felder der Maschinenraum-Bereitschaft, die für die Anzeige zählen.
 *
 * Absichtlich strukturell statt `EngineReadinessStatus` aus `@uwe/ai-brain`: so
 * bleibt shared-ui frei von einer Abhängigkeit auf ein Logik-Paket, und beide
 * Apps rechnen trotzdem mit derselben Funktion. Vorher lag sie nur in Studio —
 * Brain hätte sie für das Mail-Center abschreiben müssen.
 */
export interface EngineReadinessLike {
  ready: boolean;
  agentStatus?: string;
  connectorDegraded?: boolean;
  urlAllowed?: boolean;
}

/** Bereitschaft des Maschinenraum-Hosts auf den Zustand des Abzeichens abbilden. */
export function mapEngineReadinessToConnectorState(status: EngineReadinessLike): EngineConnectorState {
  if (status.agentStatus === "disabled" && !status.ready) {
    return "disabled";
  }
  if (status.connectorDegraded && status.ready) {
    return "starting";
  }
  if (status.ready) {
    return "online";
  }
  if (status.agentStatus === "starting") {
    return "starting";
  }
  if (status.agentStatus === "error" || status.urlAllowed === false) {
    return "error";
  }
  return "offline";
}

/** Per-state tone for the Maschinenraum status badge (badge chrome + dot fill). */
const ENGINE_TONE: Record<EngineConnectorState, { badge: string; dot: string }> = {
  online: {
    badge:
      "border-[color-mix(in_srgb,var(--uwe-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--uwe-success)_14%,transparent)] text-[color-mix(in_srgb,var(--uwe-success)_72%,var(--uwe-fg)_28%)]",
    dot: "bg-[var(--uwe-success)]",
  },
  starting: {
    badge:
      "border-[color-mix(in_srgb,var(--uwe-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--uwe-warning)_14%,transparent)] text-warning",
    dot: "bg-[var(--uwe-warning)]",
  },
  offline: {
    badge:
      "border-[color-mix(in_srgb,var(--uwe-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--uwe-danger)_14%,transparent)] text-[color-mix(in_srgb,var(--uwe-danger)_72%,var(--uwe-fg)_28%)]",
    dot: "bg-[var(--uwe-danger)]",
  },
  error: {
    badge:
      "border-[color-mix(in_srgb,var(--uwe-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--uwe-danger)_14%,transparent)] text-[color-mix(in_srgb,var(--uwe-danger)_72%,var(--uwe-fg)_28%)]",
    dot: "bg-[var(--uwe-danger)]",
  },
  disabled: {
    badge: "border-border bg-[color-mix(in_srgb,var(--uwe-fg-muted)_12%,transparent)] text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

/**
 * Consistent Maschinenraum/local-AI status indicator. Uses a colored dot + label and a
 * tooltip so the technical Maschinenraum state stays understandable across Studio.
 */
export function EngineStatusBadge({
  state,
  label,
  className,
}: {
  state: EngineConnectorState;
  label?: string;
  className?: string;
}) {
  const tone = ENGINE_TONE[state];
  return (
    <span
      className={`${BADGE_BASE} ${tone.badge}${className ? ` ${className}` : ""}`}
      data-engine-state={state}
      title={ENGINE_STATE_DESCRIPTIONS[state]}
      aria-label={`Maschinenraum-Status: ${ENGINE_STATE_LABELS[state]}. ${ENGINE_STATE_DESCRIPTIONS[state]}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${tone.dot}`} aria-hidden />
      {label ?? ENGINE_STATE_LABELS[state]}
    </span>
  );
}

export function GameSessionStatusBadge({ status }: { status: GameSessionStatus }) {
  const className = `${BADGE_BASE} ${
    status === "summarized"
      ? BADGE_TONE.published
      : status === "archived"
        ? BADGE_TONE.plain
        : status === "played"
          ? BADGE_TONE.player
          : BADGE_TONE.draft
  }`;

  return <span className={className}>{GAME_SESSION_STATUS_LABELS[status]}</span>;
}

export function PlayerNoteStatusBadge({ status }: { status: PlayerNoteStatus }) {
  const className = `${BADGE_BASE} ${
    status === "accepted"
      ? BADGE_TONE.published
      : status === "visible_to_dm"
        ? BADGE_TONE.player
        : status === "hidden" || status === "deleted"
          ? BADGE_TONE.plain
          : BADGE_TONE.draft
  }`;

  return <span className={className}>{PLAYER_NOTE_STATUS_LABELS[status]}</span>;
}

/**
 * Quest lifecycle badge. `null`/`undefined` counts as "open" (no explicit
 * status set), mirroring the portal questlog semantics.
 */
export function QuestStatusBadge({ status }: { status: QuestLifecycleStatus | null | undefined }) {
  const effective: QuestLifecycleStatus = status ?? "open";
  const className = `${BADGE_BASE} ${
    effective === "completed"
      ? BADGE_TONE.published
      : effective === "failed"
        ? BADGE_TONE.danger
        : BADGE_TONE.player
  }`;

  return (
    <span
      className={className}
      title={QUEST_STATUS_DESCRIPTIONS[effective]}
      aria-label={`Quest-Status: ${QUEST_STATUS_LABELS[effective]}. ${QUEST_STATUS_DESCRIPTIONS[effective]}`}
    >
      {QUEST_STATUS_LABELS[effective]}
    </span>
  );
}

export function DungeonPrepStatusBadge({ status }: { status: DungeonPrepStatus | null }) {
  if (!status) return <span className={`${BADGE_BASE} ${BADGE_TONE.plain}`}>—</span>;

  const className = `${BADGE_BASE} ${
    status === "played"
      ? BADGE_TONE.player
      : status === "ready"
        ? BADGE_TONE.published
        : status === "skipped"
          ? BADGE_TONE.plain
          : BADGE_TONE.draft
  }`;

  return <span className={className}>{DUNGEON_PREP_STATUS_LABELS[status]}</span>;
}
