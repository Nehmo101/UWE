/**
 * Normalizes procedural/AI draft features before the Atlas editor can preview
 * and accept them. RTX may enrich labels and hints, but geometry must already be
 * a supported Atlas feature shape.
 */

import { AtlasFeatureKind, BiomeKind, LAYER_Z } from "./constants";
import type { AtlasFeatureKind as AtlasFeatureKindValue, BiomeKind as BiomeKindValue } from "./constants";
import type { AtlasGeometry } from "./geometry";
import { hashStringToSeed } from "./prng";
import { tryParseGeometry } from "./serialization";

export type AtlasDraftProposalKind = Extract<
  AtlasFeatureKindValue,
  "region" | "river" | "road" | "biome" | "relief" | "pin" | "plot"
>;

export interface AtlasDraftFeatureProposal {
  id?: string;
  kind: AtlasDraftProposalKind;
  geometry: AtlasGeometry;
  style?: Record<string, unknown>;
  labelHint?: string;
  labelColor?: "black" | "red";
  layer: number;
  meta?: Record<string, unknown>;
}

const KIND_ALIASES: Record<string, AtlasDraftProposalKind> = {
  coastline: AtlasFeatureKind.region,
  region: AtlasFeatureKind.region,
  forest: AtlasFeatureKind.biome,
  biome: AtlasFeatureKind.biome,
  mountain: AtlasFeatureKind.relief,
  relief: AtlasFeatureKind.relief,
  river: AtlasFeatureKind.river,
  road: AtlasFeatureKind.road,
  city: AtlasFeatureKind.pin,
  pin: AtlasFeatureKind.pin,
  plot: AtlasFeatureKind.plot,
};

const DEFAULT_LAYER: Record<AtlasDraftProposalKind, number> = {
  region: LAYER_Z.relief,
  river: LAYER_Z.rivers,
  road: LAYER_Z.roads,
  biome: LAYER_Z.biome,
  relief: LAYER_Z.relief,
  pin: LAYER_Z.objects,
  plot: 18,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonRecord(value: unknown, maxKeys = 24): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, maxKeys)) {
    if (entry == null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      out[key] = entry;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function resolveKind(raw: Record<string, unknown>): AtlasDraftProposalKind | null {
  const kind = typeof raw.kind === "string" ? KIND_ALIASES[raw.kind] : undefined;
  if (kind) return kind;
  return typeof raw.atlasKind === "string" ? (KIND_ALIASES[raw.atlasKind] ?? null) : null;
}

function geometryMatchesKind(kind: AtlasDraftProposalKind, geometry: AtlasGeometry): boolean {
  if (kind === "region" || kind === "biome" || kind === "plot") return geometry.type === "Polygon";
  if (kind === "river" || kind === "road" || kind === "relief") return geometry.type === "Path";
  return kind === "pin" && geometry.type === "Point";
}

function resolveBiome(raw: Record<string, unknown>, style: Record<string, unknown>): BiomeKindValue | undefined {
  const candidate = typeof style.biomeKind === "string" ? style.biomeKind : raw.biome;
  return typeof candidate === "string" && Object.values(BiomeKind).includes(candidate as BiomeKindValue)
    ? (candidate as BiomeKindValue)
    : undefined;
}

function resolveLayer(raw: Record<string, unknown>, kind: AtlasDraftProposalKind): number {
  return typeof raw.layer === "number" && Number.isFinite(raw.layer) && raw.layer >= 0 && raw.layer <= 100
    ? raw.layer
    : DEFAULT_LAYER[kind];
}

export function normalizeAtlasDraftFeature(raw: unknown): AtlasDraftFeatureProposal | null {
  if (!isRecord(raw)) return null;
  const kind = resolveKind(raw);
  if (!kind) return null;

  const geometry = tryParseGeometry(raw.geometry);
  if (!geometry || !geometryMatchesKind(kind, geometry)) return null;

  const style = jsonRecord(raw.style) ?? {};
  const biome = resolveBiome(raw, style);
  if (kind === "biome" && biome) style.biomeKind = biome;
  if (kind === "plot") {
    style.plotPreset = "gouache_scatter";
    style.biomeKind = biome ?? BiomeKind.forest;
    style.density = typeof style.density === "number" && Number.isFinite(style.density) ? style.density : 1;
    style.seed = typeof style.seed === "number" && Number.isFinite(style.seed)
      ? style.seed
      : hashStringToSeed(String(raw.id ?? raw.labelHint ?? "atlas-plot"));
  }

  return {
    ...(safeString(raw.id, 120) ? { id: safeString(raw.id, 120) } : {}),
    kind,
    geometry,
    ...(Object.keys(style).length > 0 ? { style } : {}),
    ...(safeString(raw.labelHint, 120) ? { labelHint: safeString(raw.labelHint, 120) } : {}),
    labelColor: raw.labelColor === "red" ? "red" : "black",
    layer: resolveLayer(raw, kind),
    ...(jsonRecord(raw.meta) ? { meta: jsonRecord(raw.meta) } : {}),
  };
}

export function normalizeAtlasDraftFeatures(rawFeatures: unknown): AtlasDraftFeatureProposal[] {
  if (!Array.isArray(rawFeatures)) return [];
  return rawFeatures
    .map((feature) => normalizeAtlasDraftFeature(feature))
    .filter((feature): feature is AtlasDraftFeatureProposal => feature !== null);
}
