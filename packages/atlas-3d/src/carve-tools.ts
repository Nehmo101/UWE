/**
 * Carve-op editor helpers — op construction, German summaries and removal.
 * Split out of editor-app to keep it within the file-size budget.
 */

import type { CarveBite, CarveOp, CarveTunnel, Vec3 } from "@uwe/atlas-editor/carve";

export interface CarveOpSummary {
  id: string;
  kind: CarveOp["kind"];
  /** UI label with a running number per kind, e.g. "Biss 2"; split stays "Welt-Spalt". */
  label: string;
  /** Non-destructive stack: disabled ops stay listed but are not applied. */
  disabled?: boolean;
}

export const CARVE_KIND_LABELS: Record<CarveOp["kind"], string> = {
  bite: "Biss",
  cave: "Höhle",
  tunnel: "Tunnel",
  wedge: "Keil",
  split: "Welt-Spalt",
};

export function summarizeCarveOps(ops: readonly CarveOp[]): CarveOpSummary[] {
  const counts: Partial<Record<CarveOp["kind"], number>> = {};
  return ops.map((op) => {
    const n = (counts[op.kind] = (counts[op.kind] ?? 0) + 1);
    return {
      id: op.id,
      kind: op.kind,
      label: op.kind === "split" ? CARVE_KIND_LABELS.split : `${CARVE_KIND_LABELS[op.kind]} ${n}`,
      ...(op.disabled === true ? { disabled: true } : {}),
    };
  });
}

/** Order-preserving removal; unknown ids are a no-op. */
export function removeCarveOpById(ops: readonly CarveOp[], id: string): CarveOp[] {
  return ops.filter((op) => op.id !== id);
}

export function makeBiteOp(point: Vec3, brushRadius: number, seq: number): CarveBite {
  return {
    id: `biss-${Date.now().toString(36)}-${seq}`,
    kind: "bite",
    center: point,
    radius: Math.max(0.12, brushRadius),
  };
}

export function makeTunnelOp(from: Vec3, to: Vec3, brushRadius: number, seq: number): CarveTunnel {
  return {
    id: `tunnel-${Date.now().toString(36)}-${seq}`,
    kind: "tunnel",
    from,
    to,
    radius: Math.max(0.08, brushRadius * 0.5),
  };
}
