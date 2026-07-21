import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Globe, Map as MapIcon, Mountain } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

const LEVEL_ICONS: Record<string, typeof Globe> = {
  globe: Globe,
  continent: MapIcon,
  landscape: Mountain,
  city: Building2,
};

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/**
 * Player view of the Atlas 3D hierarchy. Atlas 3D content is entirely
 * player-visible (owner decision 2026-07-21) — access is gated by world
 * membership only, never per entity.
 */
export default async function PortalAtlas3DIndexPage({ params }: Props) {
  const { worldSlug } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const atlasWorld = await atlas3d.getAtlasWorldBySlug(worldSlug);

  const nodes = atlasWorld?.nodes ?? [];
  const byParent = new Map<string | null, typeof nodes>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), node]);
  }

  function renderNodes(parentId: string | null, depth: number): React.ReactNode {
    const children = byParent.get(parentId) ?? [];
    return children.map((node) => {
      const Icon = LEVEL_ICONS[node.level] ?? MapIcon;
      return (
        <li key={node.id} style={{ paddingLeft: depth * 20 }}>
          <Link
            href={`/auth/worlds/${worldSlug}/atlas3d/${node.id}`}
            className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 font-medium">{node.title}</span>
            <span className="text-xs text-muted-foreground">{LEVEL_LABELS[node.level] ?? node.level}</span>
          </Link>
          <ul>{renderNodes(node.id, depth + 1)}</ul>
        </li>
      );
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Atlas 3D" summary="Die Welt als lebendige 3D-Karte — vom Planeten bis zur Stadt." />
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="atlas3d-portal-empty">
          Für diese Welt gibt es noch keine 3D-Karte.
        </p>
      ) : (
        <ul className="space-y-0.5" data-testid="atlas3d-portal-tree">
          {renderNodes(null, 0)}
        </ul>
      )}
    </div>
  );
}
