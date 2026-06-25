"use client";

import { useMemo } from "react";
import type { GraphEdge, GraphNode, GraphNodeCategory } from "@uwe/database/graph-types";
import { GRAPH_NODE_CATEGORY_LABELS } from "@uwe/database/graph-types";

export interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  compact?: boolean;
  height?: number;
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
}

const CATEGORY_COLORS: Record<GraphNodeCategory, string> = {
  npc: "#f472b6",
  location: "#34d399",
  faction: "#fbbf24",
  session: "#60a5fa",
  dungeon: "#a78bfa",
  item: "#fb923c",
  lore: "#94a3b8",
  quest: "#f87171",
  handout: "#2dd4bf",
};

function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const focus = nodes.find((node) => node.isFocus) ?? nodes[0];
  const others = nodes.filter((node) => node.id !== focus.id);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const positioned: LayoutNode[] = [
    { ...focus, x: cx, y: cy },
  ];

  others.forEach((node, index) => {
    const angle = (index / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
    positioned.push({
      ...node,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  if (nodes.length > 12 && !focus.isFocus) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((node, index) => ({
      ...node,
      x: 60 + (index % cols) * ((width - 120) / Math.max(cols - 1, 1)),
      y: 60 + Math.floor(index / cols) * ((height - 120) / Math.max(Math.ceil(nodes.length / cols) - 1, 1)),
    }));
  }

  return positioned;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function graphNodeAccessibleName(node: GraphNode): string {
  const category = GRAPH_NODE_CATEGORY_LABELS[node.category];
  return node.isFocus ? `${node.title}, ${category} (Fokus)` : `${node.title}, ${category}`;
}

export function GraphView({
  nodes,
  edges,
  compact = false,
  height = compact ? 220 : 520,
}: GraphViewProps) {
  const width = compact ? 360 : 900;

  const layoutNodes = useMemo(
    () => layoutGraph(nodes, edges, width, height),
    [nodes, edges, width, height],
  );

  const nodeById = useMemo(
    () => new Map(layoutNodes.map((node) => [node.id, node])),
    [layoutNodes],
  );

  if (nodes.length === 0) {
    return (
      <div className="uwe-graph uwe-graph-empty">
        <p>Keine Knoten für den aktuellen Filter.</p>
      </div>
    );
  }

  return (
    <div className={`uwe-graph${compact ? " uwe-graph-compact" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Seiten-Graph"
        className="uwe-graph-canvas"
      >
        <defs>
          <marker
            id="uwe-graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--uwe-fg-muted)" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const source = nodeById.get(edge.sourceId);
          const target = nodeById.get(edge.targetId);
          if (!source || !target) return null;

          const mx = (source.x + target.x) / 2;
          const my = (source.y + target.y) / 2;

          return (
            <g key={edge.id} className="uwe-graph-edge">
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                markerEnd="url(#uwe-graph-arrow)"
              />
              {!compact && (
                <text x={mx} y={my - 4} className="uwe-graph-edge-label">
                  {truncate(edge.label, 24)}
                </text>
              )}
            </g>
          );
        })}

        {layoutNodes.map((node) => (
          <a
            key={node.id}
            href={node.href}
            className={node.isFocus ? "uwe-graph-node uwe-graph-node-focus" : "uwe-graph-node"}
            aria-label={graphNodeAccessibleName(node)}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.isFocus ? 18 : compact ? 12 : 14}
              fill={CATEGORY_COLORS[node.category]}
              stroke={node.isFocus ? "var(--uwe-fg)" : "var(--uwe-surface)"}
              strokeWidth={node.isFocus ? 2.5 : 1.5}
            />
            <text
              x={node.x}
              y={node.y + (compact ? 24 : 28)}
              textAnchor="middle"
              className="uwe-graph-node-label"
            >
              {truncate(node.title, compact ? 14 : 22)}
            </text>
            {!compact && (
              <text
                x={node.x}
                y={node.y + 42}
                textAnchor="middle"
                className="uwe-graph-node-meta"
              >
                {GRAPH_NODE_CATEGORY_LABELS[node.category]}
              </text>
            )}
          </a>
        ))}
      </svg>

      {!compact && (
        <ul className="uwe-graph-legend">
          {(Object.entries(GRAPH_NODE_CATEGORY_LABELS) as [GraphNodeCategory, string][]).map(
            ([category, label]) => (
              <li key={category}>
                <span
                  className="uwe-graph-legend-swatch"
                  style={{ background: CATEGORY_COLORS[category] }}
                />
                {label}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

export interface GraphRelationListProps {
  edges: GraphEdge[];
  focusPageId?: string;
  nodeTitles: Record<string, string>;
}

export function GraphRelationList({
  edges,
  focusPageId,
  nodeTitles,
}: GraphRelationListProps) {
  if (edges.length === 0) {
    return <p className="uwe-empty">Keine Relationen im aktuellen Ausschnitt.</p>;
  }

  const sorted = [...edges].sort((a, b) => a.label.localeCompare(b.label, "de"));

  return (
    <ul className="uwe-graph-relations">
      {sorted.map((edge) => {
        const outgoing = edge.sourceId === focusPageId;
        const otherId = outgoing ? edge.targetId : edge.sourceId;
        const direction = outgoing ? "→" : "←";
        return (
          <li key={edge.id}>
            <span className="uwe-graph-relation-label">{edge.label}</span>
            <span className="uwe-graph-relation-arrow">{direction}</span>
            <span>{nodeTitles[otherId] ?? "Unbekannt"}</span>
            <span className="uwe-graph-relation-kind">{edge.kind}</span>
          </li>
        );
      })}
    </ul>
  );
}
