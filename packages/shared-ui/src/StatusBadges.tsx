import type {
  AssetType,
  CanonicalStatus,
  ContentBlockType,
  DungeonPrepStatus,
  GameSessionStatus,
  PageType,
  PublishStatus,
  Visibility,
} from "@uwe/database/enums";
import { EmptyState } from "./AppShell";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: "Privat",
  dm_only: "Nur GM",
  player_visible: "Portal (ohne Login)",
  public: "Öffentlich (Share-Link)",
  specific_players: "Bestimmte Spieler",
  unlock_after_session: "Nach Session",
  archived: "Archiviert",
};

/**
 * Full explanations for visibility values. The Portal exposes published content on
 * /worlds/* without authentication — these texts make that consequence explicit.
 */
export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
  private: "Streng privat — nur im Studio sichtbar, Standard für neue Inhalte.",
  dm_only: "Nur im Studio sichtbar. Erscheint niemals im Player-Portal oder in Exporten.",
  player_visible:
    "Über die Player-/World-Routen (/worlds/…) ohne Login sichtbar, sobald die Seite veröffentlicht ist.",
  public:
    "Wie Portal-sichtbar, zusätzlich über öffentliche Share-Links erreichbar (abschaltbar in den Einstellungen).",
  specific_players: "Nur für eingeloggte Spieler mit Freigabe sichtbar.",
  unlock_after_session: "Wird nach der verknüpften Session für Spieler freigeschaltet.",
  archived: "Archiviert — für Spieler ausgeblendet, im Studio weiterhin auffindbar.",
};

export const PUBLISH_LABELS: Record<PublishStatus, string> = {
  draft: "Entwurf",
  internal: "Intern",
  published: "Veröffentlicht",
  archived: "Archiviert",
};

export const CANONICAL_LABELS: Record<CanonicalStatus, string> = {
  idea: "Idee",
  draft: "Entwurf",
  canon: "Kanon",
  deprecated: "Veraltet",
  contradictory: "Widersprüchlich",
  non_canon: "Nicht kanonisch",
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
  secret: "Geheimnis",
  session: "Session",
  quest: "Quest",
  handout: "Handout",
  rule: "Regel",
  player_character: "Spielercharakter",
  monster: "Monster",
  sound: "Sound",
  map: "Karte",
  note: "Notiz",
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
  gm_note: "GM-Notiz",
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

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const className =
    visibility === "dm_only"
      ? "uwe-badge uwe-badge-secret"
      : visibility === "player_visible"
        ? "uwe-badge uwe-badge-player"
        : visibility === "public"
          ? "uwe-badge uwe-badge-public"
          : "uwe-badge";

  return (
    <span
      className={className}
      title={VISIBILITY_DESCRIPTIONS[visibility]}
      aria-label={`Sichtbarkeit: ${VISIBILITY_LABELS[visibility]}. ${VISIBILITY_DESCRIPTIONS[visibility]}`}
    >
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
}

export function PublishBadge({ status }: { status: PublishStatus }) {
  const className =
    status === "published"
      ? "uwe-badge uwe-badge-published"
      : status === "draft"
        ? "uwe-badge uwe-badge-draft"
        : "uwe-badge";

  return <span className={className}>{PUBLISH_LABELS[status]}</span>;
}

export function CanonicalBadge({ status }: { status: CanonicalStatus }) {
  return <span className="uwe-badge uwe-badge-canon">{CANONICAL_LABELS[status]}</span>;
}

export function PageTypeBadge({ type }: { type: PageType }) {
  return <span className="uwe-badge uwe-badge-type">{PAGE_TYPE_LABELS[type]}</span>;
}

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return <span className="uwe-badge uwe-badge-type">{ASSET_TYPE_LABELS[type]}</span>;
}

export function GameSessionStatusBadge({ status }: { status: GameSessionStatus }) {
  const className =
    status === "summarized"
      ? "uwe-badge uwe-badge-published"
      : status === "archived"
        ? "uwe-badge"
        : status === "played"
          ? "uwe-badge uwe-badge-player"
          : "uwe-badge uwe-badge-draft";

  return <span className={className}>{GAME_SESSION_STATUS_LABELS[status]}</span>;
}

export function PlayerNoteStatusBadge({ status }: { status: PlayerNoteStatus }) {
  const className =
    status === "accepted"
      ? "uwe-badge uwe-badge-published"
      : status === "visible_to_dm"
        ? "uwe-badge uwe-badge-player"
        : status === "hidden" || status === "deleted"
          ? "uwe-badge"
          : "uwe-badge uwe-badge-draft";

  return <span className={className}>{PLAYER_NOTE_STATUS_LABELS[status]}</span>;
}

export function DungeonPrepStatusBadge({ status }: { status: DungeonPrepStatus | null }) {
  if (!status) return <span className="uwe-badge">—</span>;

  const className =
    status === "played"
      ? "uwe-badge uwe-badge-player"
      : status === "ready"
        ? "uwe-badge uwe-badge-published"
        : status === "skipped"
          ? "uwe-badge"
          : "uwe-badge uwe-badge-draft";

  return <span className={className}>{DUNGEON_PREP_STATUS_LABELS[status]}</span>;
}

export interface ContentBlockViewModel {
  id: string;
  type: ContentBlockType;
  sortOrder: number;
  content: string;
  visibility: Visibility;
}

export function ContentBlockList({
  blocks,
  showVisibility = false,
}: {
  blocks: ContentBlockViewModel[];
  showVisibility?: boolean;
}) {
  if (blocks.length === 0) {
    return (
      <EmptyState
        title="Keine Inhaltsblöcke"
        description="Diese Seite hat noch keine Inhaltsblöcke."
      />
    );
  }

  return (
    <div className="uwe-block-list">
      {blocks.map((block) => (
        <article key={block.id} className="uwe-block-card">
          <header className="uwe-block-header">
            <span className="uwe-block-type">{BLOCK_TYPE_LABELS[block.type]}</span>
            {showVisibility && <VisibilityBadge visibility={block.visibility} />}
          </header>
          {renderBlockBody(block)}
        </article>
      ))}
    </div>
  );
}

function renderBlockBody(block: ContentBlockViewModel) {
  if (block.type === "image") {
    const src = block.content.trim();
    if (src.startsWith("http") || src.startsWith("/")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="uwe-block-image"
          style={{ maxWidth: "100%", height: "auto", borderRadius: "6px" }}
        />
      );
    }
  }

  if (block.type === "gallery") {
    const urls = block.content
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.startsWith("http") || entry.startsWith("/"));
    if (urls.length > 0) {
      return (
        <div
          className="uwe-gallery-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "0.5rem",
          }}
        >
          {urls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "6px" }}
            />
          ))}
        </div>
      );
    }
  }

  return <pre className="uwe-block-content">{block.content}</pre>;
}

export function MetaPanel({
  visibility,
  publishStatus,
  canonicalStatus,
  type,
  tags,
  aliases,
}: {
  visibility: Visibility;
  publishStatus: PublishStatus;
  canonicalStatus: CanonicalStatus;
  type: PageType;
  tags: string[];
  aliases: string[];
}) {
  return (
    <div className="uwe-meta-panel">
      <dl>
        <div>
          <dt>Typ</dt>
          <dd><PageTypeBadge type={type} /></dd>
        </div>
        <div>
          <dt>Sichtbarkeit</dt>
          <dd><VisibilityBadge visibility={visibility} /></dd>
        </div>
        <div>
          <dt>Publish</dt>
          <dd><PublishBadge status={publishStatus} /></dd>
        </div>
        <div>
          <dt>Kanon</dt>
          <dd><CanonicalBadge status={canonicalStatus} /></dd>
        </div>
        {tags.length > 0 && (
          <div>
            <dt>Tags</dt>
            <dd className="uwe-tag-list">
              {tags.map((tag) => (
                <span key={tag} className="uwe-tag">{tag}</span>
              ))}
            </dd>
          </div>
        )}
        {aliases.length > 0 && (
          <div>
            <dt>Aliase</dt>
            <dd>{aliases.join(", ")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
