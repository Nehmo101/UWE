// Pure helpers for GraphView Nachbarschaft (ego-net) chrome state.
// Kept framework-free so toggle/depth rebuild rules are unit-testable without
// mounting the full GraphEngine / React tree.

/**
 * Resolve the ego-net focus id GraphView would pass into GraphEngine when the
 * Nachbarschaft toggle is on. Returns null when compact, mode off, or the
 * anchor is missing from the current dataset (falls back to full graph).
 */
export function resolveNeighborhoodFocus(opts: {
  compact: boolean;
  localMode: boolean;
  selectedId: string | null | undefined;
  focusPageId: string | null | undefined;
  nodeIds: Iterable<string>;
}): {
  localAnchorId: string | null;
  localAnchorExists: boolean;
  canGoLocal: boolean;
  effectiveFocusId: string | null;
} {
  const idSet = opts.nodeIds instanceof Set ? opts.nodeIds : new Set(opts.nodeIds);
  const localAnchorId = opts.selectedId ?? opts.focusPageId ?? null;
  const localAnchorExists = localAnchorId != null && idSet.has(localAnchorId);
  const canGoLocal = !opts.compact && localAnchorExists;
  const effectiveFocusId =
    !opts.compact && opts.localMode && localAnchorExists ? localAnchorId : null;
  return { localAnchorId, localAnchorExists, canGoLocal, effectiveFocusId };
}

/** Clamp ego depth stepper (GraphView +/- Tiefe). */
export function stepNeighborhoodDepth(
  depth: number,
  delta: number,
  minDepth: number,
  maxDepth: number,
): number {
  return Math.min(maxDepth, Math.max(minDepth, depth + delta));
}
