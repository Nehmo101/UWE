"use client";

import Link from "next/link";
import { ResponsiveTable } from "@uwe/shared-ui";
import type { GraphEdge } from "@uwe/database/graph-types";

/**
 * Quelle → Relation → Ziel als Tabelle. Auf dem Telefon wird daraus je eine
 * Karte pro Verbindung: die Quelle trägt sie, Relation und Ziel stehen
 * beschriftet darunter. Vorher wurden drei Spalten mit Seitentiteln auf
 * 390 px zusammengeschoben.
 */
export function ConnectionMatrix({
  edges,
  nodeTitles,
  nodeHrefs = {},
  className,
}: {
  edges: GraphEdge[];
  nodeTitles: Record<string, string>;
  nodeHrefs?: Record<string, string>;
  className?: string;
}) {
  if (!edges.length) {
    return <p className="text-sm text-muted-foreground">Keine Verbindungen</p>;
  }

  const node = (id: string) =>
    nodeHrefs[id] ? <Link href={nodeHrefs[id]}>{nodeTitles[id]}</Link> : nodeTitles[id];

  return (
    <div className={className}>
      <h2 className="mb-3 text-lg font-semibold">Verbindungsmatrix</h2>
      <ResponsiveTable
        caption="Verbindungsmatrix"
        rowKey={(edge) => edge.id}
        rows={edges}
        columns={[
          {
            key: "source",
            label: "Quelle",
            primary: true,
            render: (edge) => node(edge.sourceId),
          },
          { key: "relation", label: "Relation", render: (edge) => edge.label },
          { key: "target", label: "Ziel", render: (edge) => node(edge.targetId) },
        ]}
      />
    </div>
  );
}
