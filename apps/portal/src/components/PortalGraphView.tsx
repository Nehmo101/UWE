"use client";

import { useEffect, useState } from "react";
import type { GraphEdge, GraphNode } from "@uwe/database/graph-types";
import { GraphView } from "@uwe/shared-ui";

interface PortalGraphViewProps {
  worldSlug: string;
}

interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function remapNodeHrefs(worldSlug: string, nodes: GraphNode[]): GraphNode[] {
  return nodes.map((node) => ({
    ...node,
    href: `/auth/worlds/${worldSlug}/${node.slug}`,
  }));
}

export function PortalGraphView({ worldSlug }: PortalGraphViewProps) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setError(null);
      try {
        const response = await fetch(`/api/worlds/${encodeURIComponent(worldSlug)}/graph`, {
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error(`Graph konnte nicht geladen werden (${response.status}).`);
        }
        const payload = (await response.json()) as GraphPayload;
        if (!cancelled) {
          setGraph({
            nodes: remapNodeHrefs(worldSlug, payload.nodes),
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
  }, [worldSlug]);

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
