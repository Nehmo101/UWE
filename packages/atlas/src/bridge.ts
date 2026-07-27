/**
 * Atlas Studio bridge protocol — framework-agnostic message contract and the
 * pure doc↔server-action transforms the Studio host needs to embed atlas.html
 * (M3). Kept here (not in the app) so the message names and the save/round-trip
 * transforms are single-source and unit-testable without Next.js or Prisma.
 *
 * Direction & origin check (see docs/handoffs/atlas-singlefile/README.md §6):
 *   Editor → Host carry `source: "uwe-atlas"`  (ready | save | visibility | ai-draft-request | plot-fill-proposal-request | handout-request)
 *   Host → Editor carry `source: "uwe-studio"` (saved | ai-draft-result | plot-fill-proposal-result | load)
 */

import type { AtlasDraftFeatureProposal } from "./draft-proposal";
import type { AtlasPlotFillProposal } from "./plot-fill-proposal";

export const ATLAS_BRIDGE_EDITOR_SOURCE = "uwe-atlas" as const;
export const ATLAS_BRIDGE_HOST_SOURCE = "uwe-studio" as const;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface EditorReadyMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "ready";
  mode: string;
}
export interface EditorSaveMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "save";
  /** Serialized v2 atlas doc (see serializeDoc). */
  doc: unknown;
}
export interface EditorVisibilityMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "visibility";
  scope: "node" | "map";
  nodeId?: string;
}
export interface EditorAiDraftRequestMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "ai-draft-request";
  seed: number;
}
export interface EditorPlotFillProposalRequestMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "plot-fill-proposal-request";
  /** Client plot key only; UWE resolves real ids server-side if needed. */
  plotKey: string;
  seed: number;
  biomeKind?: string;
  prompt?: string;
}
export interface EditorPlotFillProposalReviewMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "plot-fill-proposal-review";
  plotKey: string;
  accepted: boolean;
  objectCount?: number;
}
export interface EditorHandoutRequestMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "handout-request";
  nodeId: string;
  title: string;
}
export interface EditorNodeRenameMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "node-rename";
  nodeId: string;
  title: string;
}
export interface EditorMapStyleMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "map-style";
  /** Key into STYLE_PRESETS (e.g. "tolkien-ink", "nachtkarte"). */
  stylePreset: string;
}
export interface EditorAssetRequestMessage {
  source: typeof ATLAS_BRIDGE_EDITOR_SOURCE;
  type: "asset-request";
  /** Free-text wish for a missing palette asset; opens the RTX proposal studio. */
  prompt: string;
}
export type EditorToHostMessage =
  | EditorReadyMessage
  | EditorSaveMessage
  | EditorVisibilityMessage
  | EditorAiDraftRequestMessage
  | EditorPlotFillProposalRequestMessage
  | EditorPlotFillProposalReviewMessage
  | EditorHandoutRequestMessage
  | EditorNodeRenameMessage
  | EditorMapStyleMessage
  | EditorAssetRequestMessage;

export interface HostSavedMessage {
  source: typeof ATLAS_BRIDGE_HOST_SOURCE;
  type: "saved";
}
export interface HostAiDraftResultMessage {
  source: typeof ATLAS_BRIDGE_HOST_SOURCE;
  type: "ai-draft-result";
  features: AtlasDraftFeatureProposal[];
}
export interface HostPlotFillProposalResultMessage {
  source: typeof ATLAS_BRIDGE_HOST_SOURCE;
  type: "plot-fill-proposal-result";
  plotKey: string;
  proposal?: AtlasPlotFillProposal;
  error?: string;
}
export interface HostLoadMessage {
  source: typeof ATLAS_BRIDGE_HOST_SOURCE;
  type: "load";
  doc: unknown;
}
export type HostToEditorMessage =
  | HostSavedMessage
  | HostAiDraftResultMessage
  | HostPlotFillProposalResultMessage
  | HostLoadMessage;

const EDITOR_TYPES = new Set([
  "ready",
  "save",
  "visibility",
  "ai-draft-request",
  "plot-fill-proposal-request",
  "plot-fill-proposal-review",
  "handout-request",
  "node-rename",
  "map-style",
  "asset-request",
]);
const HOST_TYPES = new Set(["saved", "ai-draft-result", "plot-fill-proposal-result", "load"]);

/** True when `data` is a well-formed Editor→Host message (origin + type checked). */
export function isEditorMessage(data: unknown): data is EditorToHostMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as { source?: unknown; type?: unknown };
  if (d.source !== ATLAS_BRIDGE_EDITOR_SOURCE || typeof d.type !== "string" || !EDITOR_TYPES.has(d.type)) {
    return false;
  }
  if (d.type === "plot-fill-proposal-request") {
    const msg = d as { plotKey?: unknown; seed?: unknown };
    return typeof msg.plotKey === "string" && typeof msg.seed === "number" && Number.isFinite(msg.seed);
  }
  if (d.type === "plot-fill-proposal-review") {
    const msg = d as { plotKey?: unknown; accepted?: unknown };
    return typeof msg.plotKey === "string" && typeof msg.accepted === "boolean";
  }
  if (d.type === "map-style") {
    return typeof (d as { stylePreset?: unknown }).stylePreset === "string";
  }
  if (d.type === "asset-request") {
    return typeof (d as { prompt?: unknown }).prompt === "string";
  }
  return true;
}

/** True when `data` is a well-formed Host→Editor message (origin + type checked). */
export function isHostMessage(data: unknown): data is HostToEditorMessage {
  if (!data || typeof data !== "object") return false;
  const d = data as { source?: unknown; type?: unknown };
  if (d.source !== ATLAS_BRIDGE_HOST_SOURCE || typeof d.type !== "string" || !HOST_TYPES.has(d.type)) return false;
  if (d.type === "ai-draft-result") return Array.isArray((d as { features?: unknown }).features);
  if (d.type === "plot-fill-proposal-result") {
    const msg = d as { plotKey?: unknown; proposal?: unknown; error?: unknown };
    return (
      typeof msg.plotKey === "string" &&
      (msg.proposal === undefined || (typeof msg.proposal === "object" && msg.proposal !== null)) &&
      (msg.error === undefined || typeof msg.error === "string")
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Save transforms (doc → per-node server-action payloads → id round-trip)
// ---------------------------------------------------------------------------

/** A feature/object entry as the save actions expect it (client key renamed). */
export interface AtlasSaveItem {
  id?: string;
  clientKey?: string;
  [field: string]: unknown;
}

/** Per-node save payload for saveAtlasFeaturesAction / saveAtlasObjectsAction. */
export interface NodeSavePayload {
  nodeId: string;
  features: AtlasSaveItem[];
  objects: AtlasSaveItem[];
}

export interface SplitDocOptions {
  /** Restrict to a single node (the studio edits one node at a time). */
  nodeId?: string;
  /**
   * Resolve a client palette key (e.g. a builtin glyph key like "castle") to a
   * real AtlasPaletteItem DB id. The save actions require a DB id, while the
   * editor may place objects keyed by glyph key. Unresolved ids are left as-is.
   */
  resolvePaletteId?: (paletteItemId: string) => string | undefined;
}

interface WithKey {
  _key?: unknown;
  [field: string]: unknown;
}

/** Strip the transient `_key` and re-expose it as `clientKey` for the save round-trip. */
function toSaveItem(item: WithKey): AtlasSaveItem {
  const { _key, ...rest } = item;
  return typeof _key === "string" ? { ...rest, clientKey: _key } : { ...rest };
}

/**
 * Group a serialized doc's features and objects by `nodeId` into per-node save
 * payloads, renaming the client key `_key` → `clientKey`.
 *
 * CRITICAL: the save actions diff-sync per node — anything omitted from a node's
 * array is DELETED server-side. Always send a node's COMPLETE set of features
 * and objects, never a partial slice.
 */
export function splitDocForSave(doc: unknown, opts: SplitDocOptions = {}): NodeSavePayload[] {
  const d = (doc ?? {}) as { features?: unknown; objects?: unknown };
  const features = Array.isArray(d.features) ? (d.features as WithKey[]) : [];
  const objects = Array.isArray(d.objects) ? (d.objects as WithKey[]) : [];
  const byNode = new Map<string, NodeSavePayload>();
  const ensure = (nodeId: string): NodeSavePayload => {
    let p = byNode.get(nodeId);
    if (!p) {
      p = { nodeId, features: [], objects: [] };
      byNode.set(nodeId, p);
    }
    return p;
  };

  for (const f of features) {
    const nodeId = f.nodeId;
    if (typeof nodeId !== "string") continue;
    if (opts.nodeId && nodeId !== opts.nodeId) continue;
    ensure(nodeId).features.push(toSaveItem(f));
  }
  for (const o of objects) {
    const nodeId = o.nodeId;
    if (typeof nodeId !== "string") continue;
    if (opts.nodeId && nodeId !== opts.nodeId) continue;
    const item = toSaveItem(o);
    if (opts.resolvePaletteId && typeof item.paletteItemId === "string") {
      const resolved = opts.resolvePaletteId(item.paletteItemId);
      if (resolved) item.paletteItemId = resolved;
    }
    ensure(nodeId).objects.push(item);
  }
  return [...byNode.values()];
}

/**
 * Map `{ clientKey, id }` pairs returned by the save actions back onto the doc's
 * features/objects (matched by `_key`), so subsequently-created rows carry their
 * DB id (needed for drill-down / pin linking without a reload). Mutates in place.
 */
export function applySavedIds(
  doc: unknown,
  saved: ReadonlyArray<{ clientKey: string; id: string }>,
): void {
  if (!doc || typeof doc !== "object") return;
  const idByKey = new Map(saved.map((s) => [s.clientKey, s.id]));
  const d = doc as { features?: unknown; objects?: unknown };
  for (const arr of [d.features, d.objects]) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr as WithKey[]) {
      if (item && typeof item._key === "string" && idByKey.has(item._key)) {
        (item as { id?: string }).id = idByKey.get(item._key);
      }
    }
  }
}
