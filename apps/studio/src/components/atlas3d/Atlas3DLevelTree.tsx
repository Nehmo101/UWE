"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { atlas3DLevelLabel } from "@uwe/atlas-3d/level-labels";
import type { ChronicleActor } from "@uwe/atlas-3d/chronicle";
import {
  deleteAtlas3DFeatureAction,
  deleteAtlas3DNodeAction,
  resetAtlas3DNodeAction,
  updateAtlas3DNodeAction,
} from "@/app/atlas3d-actions";
import { Atlas3DChroniclePanel } from "./Atlas3DChroniclePanel";

export interface Atlas3DTreeNode {
  id: string;
  title: string;
  level: string;
  parentId: string | null;
}

export interface Atlas3DRegionFeatureItem {
  id: string;
  title: string;
  childNodeId: string | null;
}

export interface Atlas3DLevelTreeProps {
  worldSlug: string;
  currentNodeId: string;
  /** Seed der aktuellen Ebene (Neu ableiten + Chronik). */
  currentNodeSeed: number;
  nodes: Atlas3DTreeNode[];
  /** Region markers of the CURRENT node. */
  regionFeatures: Atlas3DRegionFeatureItem[];
  /** Disables the reset buttons while a debounced editor save is running. */
  saveInFlight: boolean;
  /** Shell clears its pending debounced save before a reset fires. */
  onBeforeReset: () => void;
  onClose: () => void;
}

/**
 * Level-tree panel: direct navigation to every atlas level plus the
 * destructive management actions (delete sub-level, delete region marker,
 * two-stage reset). Destructive actions use window.confirm (house pattern).
 */
export function Atlas3DLevelTree(props: Atlas3DLevelTreeProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chronicleOpen, setChronicleOpen] = useState(false);

  const byParent = new Map<string | null, Atlas3DTreeNode[]>();
  for (const node of props.nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }
  const byId = new Map(props.nodes.map((node) => [node.id, node]));
  const childTitle = (childNodeId: string | null) => (childNodeId ? byId.get(childNodeId)?.title : undefined);

  const isCurrentOrAncestorOfCurrent = (nodeId: string): boolean => {
    let walker: Atlas3DTreeNode | undefined = byId.get(props.currentNodeId);
    while (walker) {
      if (walker.id === nodeId) return true;
      walker = walker.parentId ? byId.get(walker.parentId) : undefined;
    }
    return false;
  };

  const deleteNode = (node: Atlas3DTreeNode) => {
    if (busy) return;
    if (!window.confirm(`„${node.title}“ und alle Unter-Ebenen unwiderruflich löschen?`)) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", node.id);
    deleteAtlas3DNodeAction(form)
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Löschen fehlgeschlagen");
        } else if (result.parentId && isCurrentOrAncestorOfCurrent(node.id)) {
          router.push(`/worlds/${props.worldSlug}/atlas3d/${result.parentId}`);
        } else {
          router.refresh();
        }
      })
      .catch(() => setError("Löschen fehlgeschlagen"))
      .finally(() => setBusy(false));
  };

  const deleteRegion = (feature: Atlas3DRegionFeatureItem) => {
    if (busy) return;
    const linked = childTitle(feature.childNodeId);
    const message = linked
      ? `Regions-Marker „${feature.title}“ löschen? Die Unter-Ebene „${linked}“ bleibt bestehen und ist weiter über den Ebenen-Baum erreichbar.`
      : `Regions-Marker „${feature.title}“ löschen?`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", props.currentNodeId);
    form.set("featureId", feature.id);
    deleteAtlas3DFeatureAction(form)
      .then((result) => {
        if (!result.ok) setError(result.error ?? "Löschen fehlgeschlagen");
        else router.refresh();
      })
      .catch(() => setError("Löschen fehlgeschlagen"))
      .finally(() => setBusy(false));
  };

  const resetNode = (scope: "edits" | "full") => {
    if (busy || props.saveInFlight) return;
    const message =
      scope === "edits"
        ? "Alle Bearbeitungen dieser Ebene löschen (Terrain, Objekte, Pfade, Labels, Lesezeichen, Umgebungs-Overrides)? Regionen und Unter-Ebenen bleiben erhalten."
        : "Diese Ebene vollständig zurücksetzen? Auch alle Regionen und sämtliche Unter-Ebenen werden unwiderruflich gelöscht.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    props.onBeforeReset();
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", props.currentNodeId);
    form.set("scope", scope);
    resetAtlas3DNodeAction(form)
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Zurücksetzen fehlgeschlagen");
          setBusy(false);
        } else {
          // Hard reload: the editor app mounts once per node — only a fresh
          // page guarantees a pristine doc and an empty undo stack.
          window.location.reload();
        }
      })
      .catch(() => {
        setError("Zurücksetzen fehlgeschlagen");
        setBusy(false);
      });
  };

  /** Neu ableiten: zufälliger Seed für die aktuelle Ebene, dann harter Reload. */
  const rerollSeed = () => {
    if (busy || props.saveInFlight) return;
    const message =
      "Diese Ebene mit einem neuen Seed ableiten? Prozedurale Inhalte (Grundterrain, Streuungen, Namen) ändern sich; gespeicherte Bearbeitungen bleiben erhalten.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    props.onBeforeReset();
    const randomSeed = new Uint32Array(1);
    crypto.getRandomValues(randomSeed);
    const form = new FormData();
    form.set("worldSlug", props.worldSlug);
    form.set("nodeId", props.currentNodeId);
    form.set("seed", String(randomSeed[0] % 1_000_000_000));
    updateAtlas3DNodeAction(form)
      .then((result) => {
        if (!result.ok) {
          setError(result.error ?? "Neu ableiten fehlgeschlagen");
          setBusy(false);
        } else {
          // Hard reload: der Editor mountet einmal pro Node — nur eine frische
          // Seite garantiert Szene + Undo-Stack auf dem neuen Seed.
          window.location.reload();
        }
      })
      .catch(() => {
        setError("Neu ableiten fehlgeschlagen");
        setBusy(false);
      });
  };

  const chronicleActors: ChronicleActor[] = [
    ...props.nodes.filter((node) => node.parentId !== null).map((node): ChronicleActor => ({ name: node.title, kind: "ort" })),
    ...props.regionFeatures.map((feature): ChronicleActor => ({ name: feature.title, kind: "region" })),
  ];

  const renderNodes = (parentId: string | null, depth: number): React.ReactNode => {
    const children = byParent.get(parentId) ?? [];
    if (children.length === 0) return null;
    return (
      <ul className="atlas3d-tree-list">
        {children.map((node) => (
          <li key={node.id} style={{ paddingLeft: depth > 0 ? "1rem" : 0 }}>
            <span className="atlas3d-tree-row">
              <Link
                href={`/worlds/${props.worldSlug}/atlas3d/${node.id}`}
                className={node.id === props.currentNodeId ? "atlas3d-tree-link on" : "atlas3d-tree-link"}
                aria-current={node.id === props.currentNodeId ? "page" : undefined}
              >
                {node.title} <em>{atlas3DLevelLabel(node.level)}</em>
              </Link>
              {node.parentId !== null ? (
                <button
                  type="button"
                  className="atlas3d-tool"
                  title={`„${node.title}“ löschen`}
                  aria-label={`Ebene ${node.title} löschen`}
                  disabled={busy}
                  onClick={() => deleteNode(node)}
                >
                  ✕
                </button>
              ) : null}
            </span>
            {renderNodes(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="atlas3d-region atlas3d-tree" data-testid="atlas3d-level-tree">
      <div className="atlas3d-tree-head">
        <span>🌍 Ebenen</span>
        <button type="button" className="atlas3d-tool" onClick={props.onClose}>
          Schließen
        </button>
      </div>
      {renderNodes(null, 0)}
      <div className="atlas3d-tree-section" data-testid="atlas3d-region-list">
        <span>▱ Regions-Marker dieser Ebene:</span>
        {props.regionFeatures.length === 0 ? <em>keine</em> : null}
        {props.regionFeatures.map((feature) => (
          <span key={feature.id} className="atlas3d-tree-row">
            {feature.title}{" "}
            {feature.childNodeId ? (
              <Link href={`/worlds/${props.worldSlug}/atlas3d/${feature.childNodeId}`} className="atlas3d-tree-link">
                → öffnet {childTitle(feature.childNodeId) ?? "Unter-Ebene"}
              </Link>
            ) : (
              <em>(ohne Unter-Ebene)</em>
            )}
            <button
              type="button"
              className="atlas3d-tool"
              title="Regions-Marker löschen"
              aria-label={`Regions-Marker ${feature.title} löschen`}
              disabled={busy}
              onClick={() => deleteRegion(feature)}
            >
              🗑
            </button>
          </span>
        ))}
      </div>
      <div className="atlas3d-tree-section">
        <span>Zurücksetzen:</span>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-reset-edits"
          disabled={busy || props.saveInFlight}
          onClick={() => resetNode("edits")}
        >
          ↺ Bearbeitungen zurücksetzen
        </button>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-reset-full"
          disabled={busy || props.saveInFlight}
          onClick={() => resetNode("full")}
        >
          ⟲ Komplett zurücksetzen
        </button>
        <button
          type="button"
          className="atlas3d-tool"
          data-testid="atlas3d-reseed"
          disabled={busy || props.saveInFlight}
          onClick={rerollSeed}
        >
          ↻ Neu ableiten (neuer Seed)
        </button>
        <button
          type="button"
          className={chronicleOpen ? "atlas3d-tool on" : "atlas3d-tool"}
          data-testid="atlas3d-chronicle"
          aria-pressed={chronicleOpen}
          onClick={() => setChronicleOpen((open) => !open)}
        >
          📜 Chronik
        </button>
      </div>
      {chronicleOpen ? <Atlas3DChroniclePanel seed={props.currentNodeSeed} actors={chronicleActors} /> : null}
      {error ? <em className="atlas3d-error">{error}</em> : null}
    </div>
  );
}
