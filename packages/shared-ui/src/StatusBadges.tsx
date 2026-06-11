import type {
  AssetType,
  CanonicalStatus,
  ContentBlockType,
  GameSessionStatus,
  PageType,
  PublishStatus,
  Visibility,
} from "@uwe/database/enums";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  dm_only: "Nur GM",
  player_visible: "Spieler",
  public: "Öffentlich",
  specific_players: "Bestimmte Spieler",
  unlock_after_session: "Nach Session",
  archived: "Archiviert",
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

export const GAME_SESSION_STATUS_LABELS: Record<GameSessionStatus, string> = {
  planned: "Geplant",
  prepared: "Vorbereitet",
  played: "Gespielt",
  summarized: "Zusammengefasst",
  archived: "Archiviert",
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

  return <span className={className}>{VISIBILITY_LABELS[visibility]}</span>;
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
    return <p className="uwe-empty">Keine Inhaltsblöcke.</p>;
  }

  return (
    <div className="uwe-block-list">
      {blocks.map((block) => (
        <article key={block.id} className="uwe-block-card">
          <header className="uwe-block-header">
            <span className="uwe-block-type">{BLOCK_TYPE_LABELS[block.type]}</span>
            {showVisibility && <VisibilityBadge visibility={block.visibility} />}
          </header>
          <pre className="uwe-block-content">{block.content}</pre>
        </article>
      ))}
    </div>
  );
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
