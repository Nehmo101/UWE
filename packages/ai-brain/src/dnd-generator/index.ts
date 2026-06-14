import type { ContentSnapshot } from "./missing-content";
import { listActionsForContext } from "./actions";
import { contextLabel } from "./context";
import { runCanonConflictChecks } from "./canon-rules";
import { detectMissingContent } from "./missing-content";
import { listPresetsForContextKind } from "./presets";
import { mapRunsToHistory, type HistoryRunRecord } from "./history";
import type { DndContextDescriptor, DndGeneratorView } from "./types";

export interface BuildDndGeneratorViewInput {
  context: DndContextDescriptor;
  content?: ContentSnapshot;
  canonicalStatus?: string;
  duplicateTitles?: string[];
  pageContent?: string;
  recentRuns?: HistoryRunRecord[];
}

/** Assembles the full context-dependent generator view for UI and API. */
export function buildDndGeneratorView(input: BuildDndGeneratorViewInput): DndGeneratorView {
  const content = input.content ?? {};
  const missingContent = detectMissingContent(input.context, content);
  const canonConflicts = runCanonConflictChecks({
    worldSlug: input.context.worldSlug,
    context: input.context,
    pageTitle: input.context.title,
    pageContent: input.pageContent,
    canonicalStatus: input.canonicalStatus,
    duplicateTitles: input.duplicateTitles,
  });

  const actions = listActionsForContext(input.context);
  const presets = listPresetsForContextKind(input.context.kind);
  const history = mapRunsToHistory(input.recentRuns ?? []);

  return {
    context: {
      ...input.context,
      title: input.context.title ?? contextLabel(input.context),
    },
    actions,
    missingContent,
    canonConflicts,
    presets,
    history,
  };
}

export * from "./types";
export * from "./context";
export * from "./actions";
export * from "./missing-content";
export * from "./canon-rules";
export * from "./presets";
export * from "./player-safe";
export * from "./encounter-logic";
export * from "./prepare-session";
export * from "./history";
