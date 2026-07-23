import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";
import { resolveEffectiveNodeSettings } from "@uwe/atlas-editor/inheritance";
import type { Atlas3DChainEntry, Atlas3DEnvironment } from "@uwe/atlas-editor/doc";
import { ATLAS3D_LEVEL_LABELS as LEVEL_LABELS } from "@uwe/atlas-3d/level-labels";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldSectionBreadcrumb, type BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { Atlas3DEditorLazy } from "@/src/components/atlas3d";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

/** Feature-Arten, die der Editor besitzt (Region-Marker bleiben außen vor). */
const EDITOR_FEATURE_KINDS: readonly string[] = ["river", "road", "label", "territory", "poi", "lake"];

export default async function Atlas3DNodePage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const chain = await atlas3d.getNodeChain(nodeId);
  if (!chain || chain.atlasWorld.worldId !== world.id) notFound();

  const node = await atlas3d.getNode(nodeId);
  if (!node) notFound();

  // full node list for the level-tree panel (direct navigation + management)
  const atlasWorld = await atlas3d.getAtlasWorldBySlug(worldSlug);

  // Effective settings via the shared inheritance resolver (world → … → node).
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

  const titleByEntryId = new Map(chainEntries.map((entry) => [entry.id, entry.title]));
  const originTitle = (entryId: string) => (entryId === "default" ? "Standard" : (titleByEntryId.get(entryId) ?? "Standard"));

  const terrainMeta = (node.terrain?.meta ?? null) as {
    heightmap?: unknown;
    heightLayers?: unknown;
    splat?: unknown;
  } | null;

  const breadcrumb: BreadcrumbItem[] = [
    ...worldSectionBreadcrumb(world.name, worldSlug, "Atlas 3D", `/worlds/${worldSlug}/atlas3d`),
    ...chain.nodes.slice(0, -1).map(
      (entry): BreadcrumbItem => ({
        label: entry.title,
        href: `/worlds/${worldSlug}/atlas3d/${entry.id}`,
      }),
    ),
    { label: node.title },
  ];

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={<BreadcrumbTrail items={breadcrumb} />}
    >
      <div className="atlas3d-page-head">
        <h1>
          {node.title}{" "}
          <span className="atlas3d-level">{LEVEL_LABELS[node.level] ?? node.level}</span>
        </h1>
        <p className="atlas3d-effective">
          Stil: {effective.stylePreset} · Licht: {effective.environment.timeOfDay} · Seed: {effective.seed}
        </p>
      </div>
      <Atlas3DEditorLazy
        worldSlug={worldSlug}
        nodeId={node.id}
        nodeTitle={node.title}
        levelLabel={LEVEL_LABELS[node.level] ?? node.level}
        mode={node.level === "globe" ? "globe" : "terrain"}
        seed={node.seed}
        initialCarveOps={node.terrain?.carveOps ?? []}
        initialHeightmap={terrainMeta?.heightmap ?? null}
        initialHeightLayers={terrainMeta?.heightLayers ?? null}
        initialSplat={terrainMeta?.splat ?? null}
        initialObjects={node.objects.map((object) => ({
          localId: object.id,
          id: object.id,
          assetKind: object.assetKind,
          tint: object.tint,
          position: object.position,
          scale: object.scale,
          rotation: object.rotation,
        }))}
        initialFeatures={node.features
          .filter((feature) => EDITOR_FEATURE_KINDS.includes(feature.kind))
          .map((feature) => {
            const geometry = (feature.geometry ?? null) as { points?: unknown; tint?: unknown; level?: unknown } | null;
            return {
              localId: feature.id,
              id: feature.id,
              kind: feature.kind,
              points: geometry?.points ?? [],
              labelText: feature.labelText ?? undefined,
              tint: typeof geometry?.tint === "string" ? geometry.tint : undefined,
              level: typeof geometry?.level === "number" ? geometry.level : undefined,
            };
          })}
        silhouette={node.silhouette ?? null}
        waterLevel={{
          value: effective.environment.waterLevel,
          fromTitle: originTitle(effective.origins.environment.waterLevel),
          overridden: effective.origins.environment.waterLevel === node.id,
        }}
        timeOfDay={{
          value: effective.environment.timeOfDay,
          fromTitle: originTitle(effective.origins.environment.timeOfDay),
          overridden: effective.origins.environment.timeOfDay === node.id,
        }}
        fogDensity={{
          value: effective.environment.fogDensity,
          fromTitle: originTitle(effective.origins.environment.fogDensity),
          overridden: effective.origins.environment.fogDensity === node.id,
        }}
        weather={{
          value: effective.environment.weather,
          fromTitle: originTitle(effective.origins.environment.weather),
          overridden: effective.origins.environment.weather === node.id,
        }}
        season={{
          value: effective.environment.season,
          fromTitle: originTitle(effective.origins.environment.season),
          overridden: effective.origins.environment.season === node.id,
        }}
        stylePreset={{
          value: effective.stylePreset,
          fromTitle: originTitle(effective.origins.stylePreset),
          overridden: effective.origins.stylePreset === node.id,
        }}
        bookmarks={node.bookmarks.map((bookmark) => ({ id: bookmark.id, name: bookmark.name, pose: bookmark.pose }))}
        children3d={node.children.map((child) => ({
          id: child.id,
          title: child.title,
          levelLabel: LEVEL_LABELS[child.level] ?? child.level,
        }))}
        treeNodes={(atlasWorld?.nodes ?? []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          level: entry.level,
          parentId: entry.parentId,
        }))}
        regionFeatures={node.features
          .filter((feature) => feature.kind === "region")
          .map((feature) => ({
            id: feature.id,
            title: feature.labelText ?? "Region",
            childNodeId: feature.childNodeId,
          }))}
      />
    </WorldShell>
  );
}
