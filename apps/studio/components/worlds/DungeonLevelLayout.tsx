interface LevelSummary {
  id: string;
  title: string;
  slug: string;
  prepStatus: string | null;
}

interface Props {
  worldSlug: string;
  dungeonSlug: string;
  levels: LevelSummary[];
}

export function DungeonLevelLayout({ worldSlug, dungeonSlug, levels }: Props) {
  if (levels.length === 0) return null;

  return (
    <section className="uwe-v2-section">
      <h2 className="uwe-v2-section-title">Ebenen-Layout</h2>
      <div
        className="uwe-dungeon-level-layout"
        role="list"
        aria-label="Dungeon-Ebenen"
        style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
      >
        {levels.map((level, index) => (
          <a
            key={level.id}
            role="listitem"
            href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`}
            className="uwe-v2-card uwe-v2-card-padded"
            data-status={level.prepStatus}
            style={{ minWidth: "8rem", textAlign: "center" }}
          >
            <span className="uwe-dungeon-level-index">{index + 1}</span>
            <strong>{level.title}</strong>
            <span className="uwe-dashboard-muted">{level.prepStatus}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
