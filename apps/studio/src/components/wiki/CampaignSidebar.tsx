import Link from "next/link";
import { cn } from "../ui/cn";
export function CampaignSidebar({ items, title="Kampagne", className }: { items:{label:string;href:string;active?:boolean}[]; title?:string; className?:string }) {
  if(!items.length) return null;
  return <nav className={cn("space-y-1 text-sm",className)} aria-label={title}><div className="text-xs uppercase text-muted-foreground mb-2">{title}</div><ul>{items.map(i=><li key={i.href}><Link href={i.href} className={cn("block rounded-md px-2 py-1.5",i.active?"bg-primary text-primary-foreground":"hover:bg-muted")}>{i.label}</Link></li>)}</ul></nav>;
}
