import type { DungeonPrepStatus } from "@uwe/database/server";

/*
 * Pure Helfer rund um Kapitel (story_arc-Seiten). Kapitel nutzen dieselben
 * Felder wie das Dungeon-Cockpit: prepStatus für den Spielstand, sortIndex
 * für die Lesereihenfolge (Import), campaignId für die Zuordnung.
 */

export interface ChapterOrderable {
  sortIndex: number | null;
  title: string;
}

/**
 * Lesereihenfolge wie im Dungeon-Cockpit: importierte Kapitel nach sortIndex,
 * handgepflegte (sortIndex null) dahinter alphabetisch.
 */
export function compareChapterOrder(a: ChapterOrderable, b: ChapterOrderable): number {
  if (a.sortIndex != null && b.sortIndex != null && a.sortIndex !== b.sortIndex) {
    return a.sortIndex - b.sortIndex;
  }
  if (a.sortIndex != null && b.sortIndex == null) return -1;
  if (a.sortIndex == null && b.sortIndex != null) return 1;
  return a.title.localeCompare(b.title, "de");
}

export interface ChapterProgress {
  played: number;
  total: number;
  /** „3 von 7 Kapiteln gespielt" — leerer String ohne Kapitel. */
  label: string;
}

export function chapterProgress(
  chapters: Array<{ prepStatus: DungeonPrepStatus | null }>,
): ChapterProgress {
  const total = chapters.length;
  const played = chapters.filter(
    (chapter) => chapter.prepStatus === "played" || chapter.prepStatus === "skipped",
  ).length;
  return {
    played,
    total,
    label: total === 0 ? "" : `${played} von ${total} Kapiteln gespielt`,
  };
}

/**
 * Das nächste bespielbare Kapitel in Lesereihenfolge: das erste, das weder
 * gespielt noch übersprungen ist. Grundlage für „Aktuelles Kapitel drucken".
 */
export function findCurrentChapter<T extends ChapterOrderable & { prepStatus: DungeonPrepStatus | null }>(
  chapters: T[],
): T | null {
  const ordered = [...chapters].sort(compareChapterOrder);
  return (
    ordered.find(
      (chapter) => chapter.prepStatus !== "played" && chapter.prepStatus !== "skipped",
    ) ?? null
  );
}
