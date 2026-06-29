"use client";
import { useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap, MarkerType, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, GraphNode } from "@uwe/database/graph-types";
const C: Record<GraphNode["category"], string> = { npc:"#f472b6", location:"#34d399", faction:"#fbbf24", session:"#60a5fa", dungeon:"#a78bfa", item:"#fb923c", lore:"#94a3b8", quest:"#f87171", handout:"#2dd4bf" };
function layout(nodes:GraphNode[],w:number,h:number):Node[]{ if(!nodes.length)return[]; const f=nodes.find(n=>n.isFocus)??nodes[0]; const cx=w/2,cy=h/2,r=Math.min(w,h)*0.35; const out:Node[]=[{id:f.id,position:{x:cx,y:cy},data:{label:f.title},style:{background:C[f.category],borderRadius:8,padding:8}}]; nodes.filter(n=>n.id!==f.id).forEach((n,i)=>{const a=(i/Math.max(nodes.length-1,1))*Math.PI*2; out.push({id:n.id,position:{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r},data:{label:n.title},style:{background:C[n.category],borderRadius:8,padding:6}});}); return out;}
export function WikiFlowGraph({ nodes, edges, height=520, className }: { nodes:GraphNode[]; edges:GraphEdge[]; height?:number; className?:string }) {
  const fn=useMemo(()=>layout(nodes,900,height),[nodes,height]);
  const fe=useMemo(()=>edges.map(e=>({id:e.id,source:e.sourceId,target:e.targetId,label:e.label,markerEnd:{type:MarkerType.ArrowClosed}} satisfies Edge)),[edges]);
  if(!nodes.length) return <div className="border p-8 text-center text-muted-foreground">Keine Knoten</div>;
  return <div className={className} style={{height}}><ReactFlow nodes={fn} edges={fe} fitView nodesDraggable nodesConnectable={false} proOptions={{hideAttribution:true}}><Background/><Controls/><MiniMap/></ReactFlow></div>;
}
