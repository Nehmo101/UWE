"use client";
import Link from "next/link";
import type { GraphEdge } from "@uwe/database/graph-types";
export function ConnectionMatrix({ edges, nodeTitles, nodeHrefs={}, className }: { edges:GraphEdge[]; nodeTitles:Record<string,string>; nodeHrefs?:Record<string,string>; className?:string }) {
  if(!edges.length) return <p className="text-sm text-muted-foreground">Keine Verbindungen</p>;
  return <div className={className}><h2 className="mb-3 text-lg font-semibold">Verbindungsmatrix</h2><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Quelle</th><th className="text-left p-2">Relation</th><th className="text-left p-2">Ziel</th></tr></thead><tbody>{edges.map(e=><tr key={e.id} className="border-t"><td className="p-2">{nodeHrefs[e.sourceId]?<Link href={nodeHrefs[e.sourceId]}>{nodeTitles[e.sourceId]}</Link>:nodeTitles[e.sourceId]}</td><td className="p-2">{e.label}</td><td className="p-2">{nodeHrefs[e.targetId]?<Link href={nodeHrefs[e.targetId]}>{nodeTitles[e.targetId]}</Link>:nodeTitles[e.targetId]}</td></tr>)}</tbody></table></div>;
}
