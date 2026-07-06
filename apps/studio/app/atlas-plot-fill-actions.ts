"use server";

import { BiomeKind } from "@uwe/atlas/constants";
import type { BiomeKind as BiomeKindValue } from "@uwe/atlas/constants";
import {
  ATLAS_PLOT_FILL_PROPOSAL_KIND,
  ATLAS_PLOT_FILL_SCHEMA_VERSION,
  validateAtlasPlotFillProposal,
  type AtlasPlotFillProposal,
  type AtlasPlotFillProposalIssue,
} from "@uwe/atlas/plot-fill-proposal";

import { requireStudioWorldEdit } from "@/src/lib/authz";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

export interface GenerateAtlasPlotFillProposalSuccess {
  proposal: AtlasPlotFillProposal;
  error?: never;
}
export interface GenerateAtlasPlotFillProposalError {
  proposal?: never;
  error: string;
}

const DEFAULT_PLOT_FILL_BIOME: BiomeKindValue = BiomeKind.forest;
const MAX_PLOT_FILL_SEED = 0xffffffff;
const VALID_PLOT_FILL_BIOMES = new Set(Object.values(BiomeKind) as BiomeKindValue[]);

const DEFAULT_PLOT_FILL_ASSETS: Record<BiomeKindValue, AtlasPlotFillProposal["assets"]> = {
  forest: [
    { gouacheKey: "g_oak", weight: 3, scaleMin: 0.78, scaleMax: 1.18 },
    { gouacheKey: "g_pine", weight: 2, scaleMin: 0.82, scaleMax: 1.24 },
    { gouacheKey: "g_bush", weight: 1, scaleMin: 0.62, scaleMax: 0.96 },
  ],
  mountains: [
    { gouacheKey: "g_pine", weight: 2, scaleMin: 0.72, scaleMax: 1.08 },
    { gouacheKey: "g_cave_mouth", weight: 0.6, scaleMin: 0.9, scaleMax: 1.25 },
    { gouacheKey: "g_ruin", weight: 0.4, scaleMin: 0.72, scaleMax: 1 },
  ],
  hills: [
    { gouacheKey: "g_oak", weight: 2, scaleMin: 0.72, scaleMax: 1.05 },
    { gouacheKey: "g_bush", weight: 2, scaleMin: 0.58, scaleMax: 0.9 },
    { gouacheKey: "g_stone_circle", weight: 0.35, scaleMin: 0.82, scaleMax: 1.1 },
  ],
  grassland: [
    { gouacheKey: "g_bush", weight: 2, scaleMin: 0.56, scaleMax: 0.86 },
    { gouacheKey: "g_oak", weight: 0.8, scaleMin: 0.72, scaleMax: 1 },
    { gouacheKey: "g_well", weight: 0.25, scaleMin: 0.72, scaleMax: 1 },
  ],
  desert: [
    { gouacheKey: "g_obelisk", weight: 0.45, scaleMin: 0.82, scaleMax: 1.18 },
    { gouacheKey: "g_pyramid", weight: 0.3, scaleMin: 0.9, scaleMax: 1.25 },
    { gouacheKey: "g_ruin", weight: 0.5, scaleMin: 0.68, scaleMax: 0.98 },
  ],
  swamp: [
    { gouacheKey: "g_bush", weight: 2, scaleMin: 0.62, scaleMax: 0.94 },
    { gouacheKey: "g_mushroom", weight: 1.2, scaleMin: 0.58, scaleMax: 0.98 },
    { gouacheKey: "g_cave_mouth", weight: 0.3, scaleMin: 0.76, scaleMax: 1.05 },
  ],
  coast: [
    { gouacheKey: "g_bush", weight: 1.2, scaleMin: 0.58, scaleMax: 0.88 },
    { gouacheKey: "g_ship", weight: 0.35, scaleMin: 0.82, scaleMax: 1.15 },
    { gouacheKey: "g_tent", weight: 0.4, scaleMin: 0.72, scaleMax: 1 },
  ],
  snow: [
    { gouacheKey: "g_pine", weight: 2.5, scaleMin: 0.76, scaleMax: 1.12 },
    { gouacheKey: "g_cave_mouth", weight: 0.35, scaleMin: 0.82, scaleMax: 1.12 },
    { gouacheKey: "g_ruin", weight: 0.3, scaleMin: 0.68, scaleMax: 0.98 },
  ],
};

function normalizePlotFillBiome(value: FormDataEntryValue | null): BiomeKindValue {
  if (typeof value !== "string") return DEFAULT_PLOT_FILL_BIOME;
  const trimmed = value.trim();
  return VALID_PLOT_FILL_BIOMES.has(trimmed as BiomeKindValue)
    ? (trimmed as BiomeKindValue)
    : DEFAULT_PLOT_FILL_BIOME;
}

function normalizePlotFillSeed(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_PLOT_FILL_SEED, Math.trunc(parsed)));
}

function formatPlotFillValidationErrors(errors: AtlasPlotFillProposalIssue[]): string {
  return errors
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");
}

/**
 * Review-only plot-fill proposal for the iframe bridge.
 *
 * TODO(atlas_fill_area): route this through the @uwe/ai-brain action/RTX
 * provider once Studio can pass provider/model config through the bridge. Keep
 * validateAtlasPlotFillProposal as the final gate and keep the editor review
 * flow explicit.
 */
export async function generateAtlasPlotFillProposalAction(
  formData: FormData,
): Promise<GenerateAtlasPlotFillProposalSuccess | GenerateAtlasPlotFillProposalError> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug") || "");
  await requireStudioWorldEdit(worldSlug);

  const plotKey = String(formData.get("plotKey") || "").trim();
  if (!plotKey) {
    return { error: "Plot-Key fehlt." };
  }

  const biomeKind = normalizePlotFillBiome(formData.get("biomeKind"));
  const seed = normalizePlotFillSeed(formData.get("seed"));
  const validation = validateAtlasPlotFillProposal({
    schemaVersion: ATLAS_PLOT_FILL_SCHEMA_VERSION,
    kind: ATLAS_PLOT_FILL_PROPOSAL_KIND,
    plotKey,
    biomeKind,
    density: 1,
    seed,
    assets: DEFAULT_PLOT_FILL_ASSETS[biomeKind],
    notes:
      "Serverseitiger Default-Vorschlag bis zur RTX/AI-Anbindung. Als Ghost-Vorschau prüfen und nur manuell übernehmen.",
    rationale:
      "Konservative Gouache-Auswahl nach Biom; UWE erzeugt daraus erst im Editor prüfbare Ghost-Objekte.",
  });

  if (!validation.ok) {
    return {
      error: `Plot-Fill-Rezept wurde serverseitig verworfen: ${formatPlotFillValidationErrors(validation.errors)}`,
    };
  }

  return { proposal: validation.proposal };
}
