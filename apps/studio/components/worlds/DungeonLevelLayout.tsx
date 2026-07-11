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
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold tracking-tight">Ebenen-Layout</h2>
      <div className="flex flex-wrap gap-3" role="list" aria-label="Dungeon-Ebenen">
        {levels.map((level, index) => (
          <a
            key={level.id}
            role="listitem"
            href={`/worlds/${worldSlug}/dungeons/${dungeonSlug}/ebenen/${level.slug}`}
            className="flex min-w-32 flex-col items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-4 text-center text-card-foreground transition-colors hover:border-primary/60"
            data-status={level.prepStatus}
          >
            <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>
            <strong>{level.title}</strong>
            <span className="text-sm text-muted-foreground">{level.prepStatus}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
