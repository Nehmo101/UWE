"use client";

import { useEffect, useState } from "react";
import type { GraphEdge, GraphNode, GraphViewMode } from "@uwe/database/graph-types";
import { GraphView } from "@uwe/shared-ui";
import { portalGraphApiUrl, remapPortalGraphHrefs } from "@/src/lib/portal-graph";

interface PortalGraphViewProps {
  worldSlug: string;
  focusPageId?: string;
  mode?: GraphViewMode;
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function PortalGraphView({ worldSlug, focusPageId, mode }: PortalGraphViewProps) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setError(null);
      try {
        const response = await fetch(
          portalGraphApiUrl(worldSlug, { focusPageId, mode }),
          {
            credentials: "same-origin",
          },
        );
        if (!response.ok) {
          throw new Error(`Graph konnte nicht geladen werden (${response.status}).`);
        }
        const payload = (await response.json()) as GraphPayload;
        if (!cancelled) {
          setGraph({
            nodes: remapPortalGraphHrefs(worldSlug, payload.nodes),
            edges: payload.edges,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
          setGraph(null);
        }
      }
    }

    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [worldSlug, focusPageId, mode]);

  if (error) {
    return (
      <div className="uwe-graph uwe-graph-empty">
        <p>{error}</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="uwe-graph uwe-graph-empty">
        <p>Beziehungsnetz wird geladen…</p>
      </div>
    );
  }

  return (
    <>
      <GraphView nodes={graph.nodes} edges={graph.edges} />
      <p className="auth-muted">
        {graph.nodes.length} Knoten · {graph.edges.length} Kanten
      </p>
    </>
  );
}
