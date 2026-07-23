import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createPrismaClient } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";
import { resolveEffectiveNodeSettings } from "@uwe/atlas-editor/inheritance";
import type { Atlas3DChainEntry, Atlas3DEnvironment } from "@uwe/atlas-editor/doc";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/shell";
import { Atlas3DPortalViewerLazy } from "@/src/components/atlas3d/Atlas3DPortalViewerLazy";
import { ATLAS3D_LEVEL_LABELS as LEVEL_LABELS } from "@uwe/atlas-3d/level-labels";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

/** Feature-Arten, die der Viewer rendert (Region-Marker bleiben außen vor). */
const VIEWER_FEATURE_KINDS: readonly string[] = ["river", "road", "label", "territory", "poi", "lake"];

export default async function PortalAtlas3DNodePage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) notFound();

  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const chain = await atlas3d.getNodeChain(nodeId);
  const node = await atlas3d.getNode(nodeId);
  if (!chain || !node) notFound();
  const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
  if (!world || chain.atlasWorld.worldId !== world.id) notFound();

  const chainEntries: Atlas3DChainEntry[] = [
    {
      id: chain.atlasWorld.id,
      title: chain.atlasWorld.title,
      level: "world",
      stylePreset: chain.atlasWorld.stylePreset,
      environment: (chain.atlasWorld.environment as Atlas3DEnvironment | null) ?? null,
      seed: chain.atlasWorld.seed,
    },
    ...chain.nodes.map(
      (entry): Atlas3DChainEntry => ({
        id: entry.id,
        title: entry.title,
        level: entry.level,
        stylePreset: entry.stylePresetOverride,
        environment: (entry.environment as Atlas3DEnvironment | null) ?? null,
        seed: entry.seed,
      }),
    ),
  ];
  const effective = resolveEffectiveNodeSettings(chainEntries);
  const terrainMeta = (node.terrain?.meta ?? null) as { heightmap?: unknown; splat?: unknown } | null;
  const parent = chain.nodes.length > 1 ? chain.nodes[chain.nodes.length - 2] : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={node.title}
        summary={`${LEVEL_LABELS[node.level] ?? node.level} · ${effective.environment.timeOfDay === "night" ? "Nacht" : "Tageslicht"} · Stil: ${effective.stylePreset}`}
      />
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={parent ? `/auth/worlds/${worldSlug}/atlas3d/${parent.id}` : `/auth/worlds/${worldSlug}/atlas3d`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {parent ? parent.title : "Übersicht"}
        </Link>
      </div>
      <Atlas3DPortalViewerLazy
        nodeTitle={node.title}
        mode={node.level === "globe" ? "globe" : "terrain"}
        seed={node.seed}
        carveOps={node.terrain?.carveOps ?? []}
        heightmap={terrainMeta?.heightmap ?? null}
        splat={terrainMeta?.splat ?? null}
        objects={node.objects.map((object) => ({
          localId: object.id,
          assetKind: object.assetKind,
          tint: object.tint,
          position: object.position,
          scale: object.scale,
          rotation: object.rotation,
        }))}
        features={node.features
          .filter((feature) => VIEWER_FEATURE_KINDS.includes(feature.kind))
          .map((feature) => {
            const geometry = (feature.geometry ?? null) as { points?: unknown; tint?: unknown; level?: unknown } | null;
            return {
              localId: feature.id,
              kind: feature.kind,
              points: geometry?.points ?? [],
              labelText: feature.labelText ?? undefined,
              tint: typeof geometry?.tint === "string" ? geometry.tint : undefined,
              level: typeof geometry?.level === "number" ? geometry.level : undefined,
            };
          })}
        silhouette={node.silhouette ?? null}
        waterLevel={effective.environment.waterLevel}
        environment={{
          timeOfDay: effective.environment.timeOfDay,
          fogDensity: effective.environment.fogDensity,
          weather: effective.environment.weather,
          season: effective.environment.season,
        }}
        stylePreset={effective.stylePreset}
        bookmarks={node.bookmarks.map((bookmark) => ({ id: bookmark.id, name: bookmark.name, pose: bookmark.pose }))}
      />
      {node.children.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Tiefer hinein:</span>
          {node.children.map((child) => (
            <Link
              key={child.id}
              href={`/auth/worlds/${worldSlug}/atlas3d/${child.id}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-foreground hover:border-primary"
            >
              {child.title} <span className="text-xs text-muted-foreground">{LEVEL_LABELS[child.level] ?? child.level}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
