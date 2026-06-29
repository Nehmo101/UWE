"use client";
import Link from "next/link";
import { SidebarSection } from "@uwe/shared-ui";
export function WikiContextPanel({ worldSlug, backlinks, outgoingLinks, relatedPages, showCreateMissing=true }: {
  worldSlug: string;
  backlinks: {title:string;href:string}[];
  outgoingLinks: {displayText:string;href?:string;status:"resolved"|"broken"|"hidden"}[];
  relatedPages: {title:string;href:string;reasons:string[]}[];
  showCreateMissing?: boolean;
}) {
  const missing = (t:string)=>`/worlds/${worldSlug}/pages/new?${new URLSearchParams({title:t})}`;
  return <div className="space-y-4 text-sm">
    <SidebarSection title="Backlinks">{backlinks.length?<ul>{backlinks.map(l=><li key={l.href}><Link href={l.href}>{l.title}</Link></li>)}</ul>:<p className="text-muted-foreground">Keine Backlinks</p>}</SidebarSection>
    <SidebarSection title="Ausgehende Links"><ul>{outgoingLinks.filter(l=>l.status==="resolved"&&l.href).map((l,i)=><li key={i}><Link href={l.href!}>{l.displayText}</Link></li>)}{outgoingLinks.filter(l=>l.status==="broken").map((l,i)=><li key={i}><span className="text-destructive">{l.displayText}</span>{showCreateMissing?<Link href={missing(l.displayText)} className="ml-2 text-xs">Erstellen</Link>:null}</li>)}</ul></SidebarSection>
    <SidebarSection title="Verwandte Seiten">{relatedPages.length?<ul>{relatedPages.map(p=><li key={p.href}><Link href={p.href}>{p.title}</Link></li>)}</ul>:<p className="text-muted-foreground">Keine</p>}</SidebarSection>
  </div>;
}
