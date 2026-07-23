/**
 * Split-op helpers — pure transforms over the carve-op list for the
 * "Welt teilen" gesture (gap width + world-root count of the single split op).
 */

import type { CarveOp } from "@uwe/atlas-editor/carve";

export const SPLIT_OP_ID = "welt-spalt";

export function splitGapOf(ops: readonly CarveOp[]): number {
  const split = ops.find((op) => op.kind === "split");
  return split && split.kind === "split" ? split.gap : 0;
}

export function splitRootsOf(ops: readonly CarveOp[]): number | undefined {
  const split = ops.find((op) => op.kind === "split");
  return split && split.kind === "split" ? split.roots : undefined;
}

/** Set the split gap, keeping the root count; a near-zero gap removes the split. */
export function withSplitGap(ops: readonly CarveOp[], gap: number): CarveOp[] {
  const roots = splitRootsOf(ops);
  const others = ops.filter((op) => op.kind !== "split");
  if (gap <= 0.005) return others;
  return [...others, { id: SPLIT_OP_ID, kind: "split", normal: [1, 0, 0], gap, ...(roots !== undefined ? { roots } : {}) }];
}

/** Set the world-root count on the existing split op (no-op without a split). */
export function withSplitRoots(ops: readonly CarveOp[], count: number): CarveOp[] {
  const clamped = Math.min(24, Math.max(1, Math.round(count)));
  return ops.map((op) => (op.kind === "split" ? { ...op, roots: clamped } : op));
}
