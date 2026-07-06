"use client";

/**
 * Studio host for the single-file Atlas editor (M3).
 *
 * Embeds packages/static-export/static/atlas.html (served same-origin from
 * /public/atlas via the copy:atlas step) in an <iframe ?mode=editor&embed=1>
 * and implements the HOST side of the postMessage bridge (README §6), wiring
 * the editor's messages to the real Studio server actions. The bridge protocol
 * + doc transforms live in @uwe/atlas/bridge (single-source, unit-tested).
 *
 * Not yet mounted by the atlas route — M4 replaces <AtlasEditor> with this host
 * and deletes the React editor. Kept here as prepared, reviewable infrastructure.
 */

import {
  ATLAS_BRIDGE_HOST_SOURCE,
  applySavedIds,
  isEditorMessage,
  splitDocForSave,
} from "@uwe/atlas/bridge";
import { normalizeAtlasDraftFeatures } from "@uwe/atlas/draft-proposal";
import { useCallback, useEffect, useRef } from "react";

import {
  createAtlasHandoutPageAction,
  generateAtlasDraftAction,
  saveAtlasFeaturesAction,
  saveAtlasObjectsAction,
  saveAtlasTileLayerAction,
  setAtlasMapVisibilityAction,
  setAtlasNodeVisibilityAction,
  updateAtlasNodeAction,
} from "@/app/atlas-actions";

interface HostDoc {
  nodes?: Array<{ id: string; title?: string }>;
  rootNodeId?: string;
  [field: string]: unknown;
}

export interface AtlasStudioHostProps {
  worldSlug: string;
  /** Full DM-context atlas doc (unfiltered) loaded into the embedded editor. */
  doc: Record<string, unknown>;
  /** Maps client palette keys (e.g. builtin glyph keys) → real AtlasPaletteItem DB ids. */
  paletteIdMap?: Record<string, string>;
}

export function AtlasStudioHost({ worldSlug, doc, paletteIdMap = {} }: AtlasStudioHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const post = useCallback((message: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    // Spread first so `source` is authoritative and cannot be overridden by a caller.
    if (win) win.postMessage({ ...message, source: ATLAS_BRIDGE_HOST_SOURCE }, window.location.origin);
  }, []);

  const handleSave = useCallback(
    async (savedDoc: unknown) => {
      const resolvePaletteId = (id: string): string | undefined => paletteIdMap[id];
      const d = (savedDoc ?? {}) as HostDoc;
      const rootNodeId = typeof d.rootNodeId === "string" ? d.rootNodeId : undefined;
      // Studio loads features/objects for rootNodeId only. Breadcrumb ancestors in
      // doc.nodes are display context — diff-syncing them would wipe their data.
      const payloads = splitDocForSave(savedDoc, { nodeId: rootNodeId, resolvePaletteId });
      const byNode = new Map(payloads.map((p) => [p.nodeId, p]));
      const nodeIds = rootNodeId ? [rootNodeId] : [...byNode.keys()];
      try {
        const allSaved: Array<{ clientKey: string; id: string }> = [];
        for (const nodeId of nodeIds) {
          const payload = byNode.get(nodeId) ?? { nodeId, features: [], objects: [] };
          const featuresFd = new FormData();
          featuresFd.set("worldSlug", worldSlug);
          featuresFd.set("nodeId", nodeId);
          featuresFd.set("features", JSON.stringify(payload.features));
          const featuresResult = await saveAtlasFeaturesAction(featuresFd);
          allSaved.push(...featuresResult.saved);

          const objectsFd = new FormData();
          objectsFd.set("worldSlug", worldSlug);
          objectsFd.set("nodeId", nodeId);
          objectsFd.set("objects", JSON.stringify(payload.objects));
          const objectsResult = await saveAtlasObjectsAction(objectsFd);
          allSaved.push(...objectsResult.saved);
        }
        applySavedIds(savedDoc, allSaved);
        // Terrain tiles live on the map (not per node) — persist once.
        const tileLayer = (d as { tileLayer?: unknown }).tileLayer;
        if (tileLayer && typeof tileLayer === "object") {
          const tileFd = new FormData();
          tileFd.set("worldSlug", worldSlug);
          tileFd.set("tileLayer", JSON.stringify(tileLayer));
          await saveAtlasTileLayerAction(tileFd);
        }
        post({ type: "saved" });
      } catch (error) {
        // Never ack on failure — the editor keeps its unsaved/dirty state.
        console.error("Atlas-Bridge: Speichern in UWE-DB fehlgeschlagen —", error);
      }
    },
    [paletteIdMap, post, worldSlug],
  );

  const handleVisibility = useCallback(
    async (scope: "node" | "map", nodeId: string | undefined, visibility: string) => {
      // Node-scope visibility requires a node id; skip rather than hit the server with none.
      if (scope === "node" && !nodeId) return;
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      if (nodeId) fd.set("nodeId", nodeId);
      fd.set("visibility", visibility);
      try {
        if (scope === "map") await setAtlasMapVisibilityAction(fd);
        else await setAtlasNodeVisibilityAction(fd);
      } catch (error) {
        console.error("Atlas-Bridge: Sichtbarkeit setzen fehlgeschlagen —", error);
      }
    },
    [worldSlug],
  );

  const handleAiDraft = useCallback(
    async (seed: number) => {
      // Proposal only — the editor shows the result as a ghost overlay for
      // manual Übernehmen/Verwerfen; never auto-applied to canon.
      const fd = new FormData();
      // Always scope by world so draft generation is authorized (requireStudioWorldEdit)
      // consistently with the other atlas actions.
      fd.set("worldSlug", worldSlug);
      fd.set("seed", String(seed));
      try {
        const result = await generateAtlasDraftAction(fd);
        const draft = result && "draft" in result ? result.draft : undefined;
        if (draft) {
          post({ type: "ai-draft-result", features: normalizeAtlasDraftFeatures(draft.features) });
        }
      } catch (error) {
        console.error("Atlas-Bridge: KI-Entwurf fehlgeschlagen —", error);
      }
    },
    [post, worldSlug],
  );

  const handleNodeRename = useCallback(
    async (nodeId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("nodeId", nodeId);
      fd.set("title", trimmed);
      try {
        await updateAtlasNodeAction(fd);
      } catch (error) {
        console.error("Atlas-Bridge: Knoten umbenennen fehlgeschlagen —", error);
      }
    },
    [worldSlug],
  );

  const handleHandout = useCallback(
    async (nodeId: string, title: string) => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("nodeId", nodeId);
      fd.set("title", title);
      try {
        await createAtlasHandoutPageAction(fd);
      } catch (error) {
        console.error("Atlas-Bridge: Handout-Seite erstellen fehlgeschlagen —", error);
      }
    },
    [worldSlug],
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // The iframe is same-origin; reject anything else outright.
      if (event.origin !== window.location.origin) return;
      // Only trust the embedded editor iframe — not other same-origin tabs/windows
      // that could spoof a bridge message.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!isEditorMessage(data)) return;
      switch (data.type) {
        case "ready":
          post({ type: "load", doc });
          break;
        case "save":
          void handleSave(data.doc);
          break;
        case "visibility":
          void handleVisibility(data.scope, data.nodeId, data.visibility);
          break;
        case "ai-draft-request":
          void handleAiDraft(data.seed);
          break;
        case "handout-request":
          void handleHandout(data.nodeId, data.title);
          break;
        case "node-rename":
          void handleNodeRename(data.nodeId, data.title);
          break;
        default:
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [doc, handleAiDraft, handleHandout, handleNodeRename, handleSave, handleVisibility, post]);

  return (
    <iframe
      ref={iframeRef}
      title="UWE Atlas Editor"
      src="/atlas/atlas.html?mode=editor&embed=1"
      style={{ width: "100%", height: "100%", border: 0, display: "block" }}
    />
  );
}
