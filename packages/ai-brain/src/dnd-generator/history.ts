import type { GeneratorHistoryEntry, DndGeneratorActionId } from "./types";

export interface HistoryRunRecord {
  id: string;
  source: string;
  taskType: string;
  createdAt: Date;
  status: string;
  resultMeta?: { actionId?: string; proposals?: unknown[] } | null;
}

export function mapRunsToHistory(runs: HistoryRunRecord[]): GeneratorHistoryEntry[] {
  return runs.map((run) => {
    const actionId = (run.resultMeta?.actionId ??
      run.source.replace("brain_action:", "")) as DndGeneratorActionId;

    return {
      runId: run.id,
      actionId: actionId || "summarize",
      createdAt: run.createdAt.toISOString(),
      label: run.taskType,
      isFavorite: false,
    };
  });
}

export function filterFavoriteVariants(
  history: GeneratorHistoryEntry[],
  favorites: Set<string>,
): GeneratorHistoryEntry[] {
  return history.map((entry) => ({
    ...entry,
    isFavorite: favorites.has(entry.runId),
  }));
}
