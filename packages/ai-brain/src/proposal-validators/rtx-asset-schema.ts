/**
 * Wire shape of an RTX-generated Atlas Gouache asset proposal.
 *
 * Split out of `rtx-asset-proposal.ts` (which stayed just under the 700-line
 * file budget in its old home) so the declarations and the validator can each
 * grow. `rtx-asset-proposal.ts` re-exports everything here, so importers keep
 * one entry point and every exported name is unchanged from
 * `@uwe/atlas/rtx-asset-proposal`.
 */

import { GOUACHE_CATEGORY_LABELS } from "./gouache-registry";
import type { GouacheAsset, GouacheCategory } from "./gouache-registry";

/**
 * Repo-relative documentation paths handed to the model as sources.
 *
 * These are *runtime strings inside the prompt*, not imports — nothing breaks
 * loudly when a file moves. `rtx-asset-proposal.test.ts` therefore asserts that
 * both files exist on disk. If a doc is renamed, fix it here as well.
 */
export const RTX_ATLAS_ASSET_STYLEGUIDE_PATH =
  "docs/prompts/atlas-pictogram-styleguide.md";
export const RTX_ATLAS_ASSET_CATALOG_PATH =
  "docs/design/atlas-redesign/asset-catalog.md";
/** Module path of the registry the proposal must not duplicate. */
export const RTX_ATLAS_ASSET_REGISTRY_EXPORT =
  "@uwe/ai-brain/proposal-validators#GOUACHE_ASSETS";

export const RTX_ATLAS_ASSET_OUTPUT_TYPES = ["json-recipe", "png-fallback"] as const;
export type RtxAtlasAssetOutputType =
  (typeof RTX_ATLAS_ASSET_OUTPUT_TYPES)[number];

export const RTX_ATLAS_ASSET_ENGINE_TAGS = ["Stamp", "Plot", "Path", "Landmark", "Gen", "Terrain"] as const;
export type RtxAtlasAssetEngineTag =
  (typeof RTX_ATLAS_ASSET_ENGINE_TAGS)[number];

export const RTX_GOUACHE_RECIPE_LAYER_ROLES = ["shadow", "base", "highlight", "detail", "outline"] as const;
export type RtxGouacheRecipeLayerRole =
  (typeof RTX_GOUACHE_RECIPE_LAYER_ROLES)[number];

export const RTX_GOUACHE_RECIPE_SHAPES = ["ellipse", "rect", "polygon", "path"] as const;
export type RtxGouacheRecipeShape =
  (typeof RTX_GOUACHE_RECIPE_SHAPES)[number];

/** Derived from the registry so the allowlist can never drift from the labels. */
export const RTX_ATLAS_ASSET_GOUACHE_CATEGORIES = Object.keys(
  GOUACHE_CATEGORY_LABELS,
) as GouacheCategory[];

export interface RtxGouacheRecipeLayer {
  id: string;
  role: RtxGouacheRecipeLayerRole;
  shape: RtxGouacheRecipeShape;
  fill?: string;
  stroke?: string;
  opacity?: number;
  lineWidth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  ry?: number;
  rotation?: number;
  points?: Array<[number, number]>;
  path?: string;
}

export interface RtxGouacheJsonRecipe {
  schemaVersion: 1;
  coordinateSystem: "base-center-normalized";
  description?: string;
  layers: RtxGouacheRecipeLayer[];
}

export interface RtxPngFallbackMetadata {
  mimeType: "image/png";
  width: number;
  height: number;
  transparentBackground: boolean;
  filename?: string;
  sha256?: string;
  altText?: string;
  notes?: string;
}

export interface RtxAtlasAssetProposalBase {
  name: string;
  category: GouacheCategory;
  tags: string[];
  engineTags: RtxAtlasAssetEngineTag[];
  palette: string[];
  prompt?: string;
  rationale?: string;
  styleguideNotes?: string;
}

export type RtxAtlasAssetProposal =
  | (RtxAtlasAssetProposalBase & {
      outputType: "json-recipe";
      recipe: RtxGouacheJsonRecipe;
    })
  | (RtxAtlasAssetProposalBase & {
      outputType: "png-fallback";
      pngFallback: RtxPngFallbackMetadata;
    });

export type RtxAtlasAssetProposalIssueCode =
  | "executable_code"
  | "invalid_type"
  | "invalid_value"
  | "missing_field"
  | "unexpected_field";

export interface RtxAtlasAssetProposalIssue {
  path: string;
  code: RtxAtlasAssetProposalIssueCode;
  message: string;
}

export type RtxAtlasAssetProposalValidationResult =
  | { ok: true; proposal: RtxAtlasAssetProposal; warnings: string[] }
  | { ok: false; errors: RtxAtlasAssetProposalIssue[] };

export interface RtxAtlasAssetPromptContext {
  styleguidePath: typeof RTX_ATLAS_ASSET_STYLEGUIDE_PATH;
  assetCatalogPath: typeof RTX_ATLAS_ASSET_CATALOG_PATH;
  registryExport: typeof RTX_ATLAS_ASSET_REGISTRY_EXPORT;
  acceptedOutputs: RtxAtlasAssetOutputType[];
  gouacheCategories: GouacheCategory[];
  assetCatalogTags: RtxAtlasAssetEngineTag[];
  existingAssets: Array<Pick<GouacheAsset, "key" | "name" | "category">>;
  styleguideExcerpt: string[];
  assetCatalogExcerpt: string[];
  rules: string[];
}
