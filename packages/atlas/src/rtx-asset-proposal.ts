/**
 * Validation and prompt-context helpers for RTX-generated Atlas Gouache assets.
 *
 * RTX may suggest data, but UWE must not execute generated source. This module
 * accepts either a constrained JSON recipe or PNG fallback metadata.
 */

import { GOUACHE_ASSETS, GOUACHE_CATEGORY_LABELS } from "./assets";
import type { GouacheAsset, GouacheCategory } from "./assets";
import {
  RTX_ATLAS_ASSET_CATALOG_EXCERPT,
  RTX_ATLAS_ASSET_STYLEGUIDE_EXCERPT,
} from "./rtx-asset-prompt-context";

export const RTX_ATLAS_ASSET_STYLEGUIDE_PATH =
  "docs/design/atlas-pictogram-styleguide.md";
export const RTX_ATLAS_ASSET_CATALOG_PATH =
  "docs/design/atlas-asset-catalog.md";
export const RTX_ATLAS_ASSET_REGISTRY_EXPORT =
  "@uwe/atlas/assets#GOUACHE_ASSETS";

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

const TOP_LEVEL_KEYS = [
  "name",
  "category",
  "tags",
  "engineTags",
  "palette",
  "prompt",
  "rationale",
  "styleguideNotes",
  "outputType",
  "recipe",
  "pngFallback",
] as const;
const RECIPE_KEYS = ["schemaVersion", "coordinateSystem", "description", "layers"] as const;
const LAYER_KEYS = [
  "id",
  "role",
  "shape",
  "fill",
  "stroke",
  "opacity",
  "lineWidth",
  "x",
  "y",
  "width",
  "height",
  "rx",
  "ry",
  "rotation",
  "points",
  "path",
] as const;
const PNG_KEYS = [
  "mimeType",
  "width",
  "height",
  "transparentBackground",
  "filename",
  "sha256",
  "altText",
  "notes",
] as const;

type NumericLayerField =
  | "opacity"
  | "lineWidth"
  | "x"
  | "y"
  | "width"
  | "height"
  | "rx"
  | "ry"
  | "rotation";

const NUMERIC_LAYER_RANGES: Record<NumericLayerField, [number, number]> = {
  opacity: [0, 1],
  lineWidth: [0, 10],
  x: [-4, 4],
  y: [-4, 4],
  width: [0, 8],
  height: [0, 8],
  rx: [0, 8],
  ry: [0, 8],
  rotation: [-Math.PI * 2, Math.PI * 2],
};

const SHAPE_REQUIRED_NUMBERS: Partial<
  Record<RtxGouacheRecipeShape, NumericLayerField[]>
> = {
  ellipse: ["x", "y", "rx", "ry"],
  rect: ["x", "y", "width", "height"],
};

const EXECUTABLE_KEYS = new Set([
  "code",
  "sourcecode",
  "script",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "executable",
  "functionbody",
  "renderfunction",
  "drawfunction",
]);

const EXECUTABLE_TEXT = [
  /<\s*script\b/i,
  /\b(?:function|class)\s+[A-Za-z_$]/,
  /=>/,
  /\bimport\s+(?:type\s+)?(?:\{|[A-Za-z_$*])/,
  /\bexport\s+(?:default|function|class|const|let|var|\{|\*)/,
  /\b(?:eval|Function|setTimeout|setInterval)\s*\(/,
  /\b(?:require|process|child_process|Deno)\b/,
];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SAFE_ID = /^[a-z][a-z0-9_-]{1,47}$/i;
const SAFE_FILENAME = /^[a-z0-9][a-z0-9._-]{0,95}\.png$/i;
const SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9,.\-\s]+$/;

function add(
  issues: RtxAtlasAssetProposalIssue[],
  path: string,
  code: RtxAtlasAssetProposalIssueCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function rejectUnknown(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      add(issues, `${path}.${key}`, "unexpected_field", `Unexpected field "${key}".`);
    }
  }
}

function scanExecutable(
  value: unknown,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
  seen = new WeakSet<object>(),
): void {
  if (typeof value === "function") {
    add(issues, path, "executable_code", "Function values are not accepted.");
    return;
  }
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT.some((pattern) => pattern.test(value))) {
      add(issues, path, "executable_code", "Executable source text is not accepted.");
    }
    return;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanExecutable(entry, `${path}[${index}]`, issues, seen));
    return;
  }
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (EXECUTABLE_KEYS.has(key.toLowerCase())) {
      add(issues, `${path}.${key}`, "executable_code", `Executable field "${key}" is not accepted.`);
    }
    scanExecutable(entry, `${path}.${key}`, issues, seen);
  }
}

function stringValue(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
  opts: { required?: boolean; max?: number } = {},
): string | undefined {
  const value = obj[key];
  if (value === undefined) {
    if (opts.required) add(issues, `${path}.${key}`, "missing_field", `${key} is required.`);
    return undefined;
  }
  if (typeof value !== "string") {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be a string.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || (opts.max !== undefined && trimmed.length > opts.max)) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} is empty or too long.`);
    return undefined;
  }
  return trimmed;
}

function numberValue(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
  opts: { required?: boolean; min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  const value = obj[key];
  if (value === undefined) {
    if (opts.required) add(issues, `${path}.${key}`, "missing_field", `${key} is required.`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be a finite number.`);
    return undefined;
  }
  if (opts.integer && !Number.isInteger(value)) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be an integer.`);
  }
  if (opts.min !== undefined && value < opts.min) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be >= ${opts.min}.`);
  }
  if (opts.max !== undefined && value > opts.max) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} must be <= ${opts.max}.`);
  }
  return value;
}

function stringArray(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
  opts: { maxItems: number; maxLength: number; pattern?: RegExp } ,
): string[] {
  const value = obj[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be an array.`);
    return [];
  }
  if (value.length > opts.maxItems) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} has too many items.`);
  }
  return value.slice(0, opts.maxItems).flatMap((entry, index) => {
    if (typeof entry !== "string") {
      add(issues, `${path}.${key}[${index}]`, "invalid_type", `${key} entries must be strings.`);
      return [];
    }
    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > opts.maxLength || (opts.pattern && !opts.pattern.test(trimmed))) {
      add(issues, `${path}.${key}[${index}]`, "invalid_value", `${key} entry is invalid.`);
      return [];
    }
    return [trimmed];
  });
}

function parseEngineTags(
  obj: Record<string, unknown>,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
): RtxAtlasAssetEngineTag[] {
  const value = obj.engineTags;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    add(issues, `${path}.engineTags`, "invalid_type", "engineTags must be an array.");
    return [];
  }
  const tags: RtxAtlasAssetEngineTag[] = [];
  value.forEach((entry, index) => {
    if (!isAllowed(entry, RTX_ATLAS_ASSET_ENGINE_TAGS)) {
      add(issues, `${path}.engineTags[${index}]`, "invalid_value", "Unknown asset catalog engine tag.");
      return;
    }
    if (!tags.includes(entry)) tags.push(entry);
  });
  return tags;
}

function parsePoints(
  value: unknown,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
  minPoints: number,
): Array<[number, number]> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < minPoints || value.length > 64) {
    add(issues, path, "invalid_value", `points must contain ${minPoints}-64 [x, y] entries.`);
    return undefined;
  }
  const points: Array<[number, number]> = [];
  value.forEach((entry, index) => {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "number" ||
      typeof entry[1] !== "number" ||
      !Number.isFinite(entry[0]) ||
      !Number.isFinite(entry[1]) ||
      entry[0] < -4 ||
      entry[0] > 4 ||
      entry[1] < -4 ||
      entry[1] > 4
    ) {
      add(issues, `${path}[${index}]`, "invalid_value", "points entries must be normalized [x, y] numbers.");
      return;
    }
    points.push([entry[0], entry[1]]);
  });
  return points;
}

function parseLayer(
  raw: unknown,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
): RtxGouacheRecipeLayer | null {
  if (!isRecord(raw)) {
    add(issues, path, "invalid_type", "Recipe layers must be objects.");
    return null;
  }
  const before = issues.length;
  rejectUnknown(raw, LAYER_KEYS, path, issues);

  const id = stringValue(raw, "id", path, issues, { required: true, max: 48 });
  if (id && !SAFE_ID.test(id)) add(issues, `${path}.id`, "invalid_value", "Layer id must be slug-like.");

  const role = isAllowed(raw.role, RTX_GOUACHE_RECIPE_LAYER_ROLES) ? raw.role : undefined;
  if (!role) add(issues, `${path}.role`, "invalid_value", "Unknown layer role.");

  const shape = isAllowed(raw.shape, RTX_GOUACHE_RECIPE_SHAPES) ? raw.shape : undefined;
  if (!shape) add(issues, `${path}.shape`, "invalid_value", "Unknown layer shape.");

  const fill = stringValue(raw, "fill", path, issues, { max: 16 });
  if (fill && !HEX_COLOR.test(fill)) add(issues, `${path}.fill`, "invalid_value", "fill must be a hex color.");
  const stroke = stringValue(raw, "stroke", path, issues, { max: 16 });
  if (stroke && !HEX_COLOR.test(stroke)) add(issues, `${path}.stroke`, "invalid_value", "stroke must be a hex color.");

  if (!id || !role || !shape) return null;
  const layer: RtxGouacheRecipeLayer = { id, role, shape };

  if (fill) layer.fill = fill;
  if (stroke) layer.stroke = stroke;
  for (const field of Object.keys(NUMERIC_LAYER_RANGES) as NumericLayerField[]) {
    const [min, max] = NUMERIC_LAYER_RANGES[field];
    const value = numberValue(raw, field, path, issues, { min, max });
    if (value !== undefined) layer[field] = value;
  }

  for (const field of SHAPE_REQUIRED_NUMBERS[shape] ?? []) {
    if (raw[field] === undefined) add(issues, `${path}.${field}`, "missing_field", `${field} is required for ${shape}.`);
  }

  const minPoints = shape === "polygon" ? 3 : 2;
  const points = parsePoints(raw.points, `${path}.points`, issues, minPoints);
  if (points) layer.points = points;
  if (shape === "polygon" && !points) add(issues, `${path}.points`, "missing_field", "polygon layers require points.");

  const pathData = stringValue(raw, "path", path, issues, { max: 1200 });
  if (pathData && !SAFE_PATH.test(pathData)) {
    add(issues, `${path}.path`, "invalid_value", "path must contain SVG path commands and numbers only.");
  }
  if (pathData) layer.path = pathData;
  if (shape === "path" && !pathData) add(issues, `${path}.path`, "missing_field", "path layers require path.");

  return issues.length === before ? layer : null;
}

function parseRecipe(
  raw: unknown,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
): RtxGouacheJsonRecipe | null {
  if (!isRecord(raw)) {
    add(issues, path, "invalid_type", "recipe must be an object.");
    return null;
  }
  const before = issues.length;
  rejectUnknown(raw, RECIPE_KEYS, path, issues);
  if (raw.schemaVersion !== 1) add(issues, `${path}.schemaVersion`, "invalid_value", "schemaVersion must be 1.");
  if (raw.coordinateSystem !== undefined && raw.coordinateSystem !== "base-center-normalized") {
    add(issues, `${path}.coordinateSystem`, "invalid_value", "coordinateSystem must be base-center-normalized.");
  }
  if (!Array.isArray(raw.layers) || raw.layers.length === 0 || raw.layers.length > 64) {
    add(issues, `${path}.layers`, "invalid_value", "recipe.layers must contain 1-64 layer objects.");
  }
  const description = stringValue(raw, "description", path, issues, { max: 500 });
  const layers = Array.isArray(raw.layers)
    ? raw.layers.flatMap((layer, index) => {
        const parsed = parseLayer(layer, `${path}.layers[${index}]`, issues);
        return parsed ? [parsed] : [];
      })
    : [];

  if (issues.length !== before) return null;
  return {
    schemaVersion: 1,
    coordinateSystem: "base-center-normalized",
    ...(description ? { description } : {}),
    layers,
  };
}

function parsePngFallback(
  raw: unknown,
  path: string,
  issues: RtxAtlasAssetProposalIssue[],
): RtxPngFallbackMetadata | null {
  if (!isRecord(raw)) {
    add(issues, path, "invalid_type", "pngFallback must be an object.");
    return null;
  }
  const before = issues.length;
  rejectUnknown(raw, PNG_KEYS, path, issues);
  if (raw.mimeType !== "image/png") add(issues, `${path}.mimeType`, "invalid_value", "mimeType must be image/png.");
  const width = numberValue(raw, "width", path, issues, { required: true, integer: true, min: 1, max: 4096 });
  const height = numberValue(raw, "height", path, issues, { required: true, integer: true, min: 1, max: 4096 });
  if (typeof raw.transparentBackground !== "boolean") {
    add(issues, `${path}.transparentBackground`, "missing_field", "transparentBackground must be a boolean.");
  }
  const filename = stringValue(raw, "filename", path, issues, { max: 100 });
  if (filename && !SAFE_FILENAME.test(filename)) {
    add(issues, `${path}.filename`, "invalid_value", "filename must be a safe .png filename.");
  }
  const sha256 = stringValue(raw, "sha256", path, issues, { max: 64 });
  if (sha256 && !/^[0-9a-f]{64}$/i.test(sha256)) {
    add(issues, `${path}.sha256`, "invalid_value", "sha256 must be 64 hex chars.");
  }
  const altText = stringValue(raw, "altText", path, issues, { max: 240 });
  const notes = stringValue(raw, "notes", path, issues, { max: 500 });

  if (issues.length !== before || width === undefined || height === undefined || typeof raw.transparentBackground !== "boolean") {
    return null;
  }
  return {
    mimeType: "image/png",
    width,
    height,
    transparentBackground: raw.transparentBackground,
    ...(filename ? { filename } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(altText ? { altText } : {}),
    ...(notes ? { notes } : {}),
  };
}

function inferOutputType(
  obj: Record<string, unknown>,
  issues: RtxAtlasAssetProposalIssue[],
): RtxAtlasAssetOutputType | undefined {
  if (obj.outputType !== undefined) {
    if (isAllowed(obj.outputType, RTX_ATLAS_ASSET_OUTPUT_TYPES)) return obj.outputType;
    add(issues, "$.outputType", "invalid_value", "outputType must be json-recipe or png-fallback.");
    return undefined;
  }
  if (obj.recipe !== undefined && obj.pngFallback === undefined) return "json-recipe";
  if (obj.pngFallback !== undefined && obj.recipe === undefined) return "png-fallback";
  add(issues, "$.outputType", "missing_field", "Provide outputType or exactly one of recipe/pngFallback.");
  return undefined;
}

/**
 * Validate an RTX Atlas asset proposal without executing or compiling anything.
 */
export function validateRtxAtlasAssetProposal(
  raw: unknown,
): RtxAtlasAssetProposalValidationResult {
  const errors: RtxAtlasAssetProposalIssue[] = [];
  scanExecutable(raw, "$", errors);
  if (!isRecord(raw)) {
    add(errors, "$", "invalid_type", "Proposal must be a JSON object.");
    return { ok: false, errors };
  }
  rejectUnknown(raw, TOP_LEVEL_KEYS, "$", errors);

  const name = stringValue(raw, "name", "$", errors, { required: true, max: 80 });
  const category = isAllowed(raw.category, RTX_ATLAS_ASSET_GOUACHE_CATEGORIES) ? raw.category : undefined;
  if (!category) add(errors, "$.category", "invalid_value", "Unknown Gouache category.");

  const tags = stringArray(raw, "tags", "$", errors, { maxItems: 12, maxLength: 40 });
  const engineTags = parseEngineTags(raw, "$", errors);
  const palette = stringArray(raw, "palette", "$", errors, { maxItems: 8, maxLength: 16, pattern: HEX_COLOR });
  const prompt = stringValue(raw, "prompt", "$", errors, { max: 280 });
  const rationale = stringValue(raw, "rationale", "$", errors, { max: 800 });
  const styleguideNotes = stringValue(raw, "styleguideNotes", "$", errors, { max: 800 });
  const outputType = inferOutputType(raw, errors);

  if (raw.recipe !== undefined && raw.pngFallback !== undefined) {
    add(errors, "$", "invalid_value", "Provide a JSON recipe or PNG fallback metadata, not both.");
  }
  const recipe = outputType === "json-recipe" ? parseRecipe(raw.recipe, "$.recipe", errors) : undefined;
  const pngFallback = outputType === "png-fallback" ? parsePngFallback(raw.pngFallback, "$.pngFallback", errors) : undefined;

  if (errors.length > 0 || !name || !category || !outputType) return { ok: false, errors };

  const base: RtxAtlasAssetProposalBase = {
    name,
    category,
    tags,
    engineTags,
    palette,
    ...(prompt ? { prompt } : {}),
    ...(rationale ? { rationale } : {}),
    ...(styleguideNotes ? { styleguideNotes } : {}),
  };
  if (outputType === "json-recipe" && recipe) {
    return { ok: true, proposal: { ...base, outputType, recipe }, warnings: [] };
  }
  if (outputType === "png-fallback" && pngFallback) {
    return { ok: true, proposal: { ...base, outputType, pngFallback }, warnings: [] };
  }
  return {
    ok: false,
    errors: [{
      path: "$.outputType",
      code: "missing_field",
      message: "A valid JSON recipe or PNG fallback metadata is required.",
    }],
  };
}

export function isRtxAtlasAssetProposal(raw: unknown): raw is RtxAtlasAssetProposal {
  return validateRtxAtlasAssetProposal(raw).ok;
}

export function buildRtxAtlasAssetPromptContext(
  assets: readonly Pick<GouacheAsset, "key" | "name" | "category">[] = GOUACHE_ASSETS,
): RtxAtlasAssetPromptContext {
  return {
    styleguidePath: RTX_ATLAS_ASSET_STYLEGUIDE_PATH,
    assetCatalogPath: RTX_ATLAS_ASSET_CATALOG_PATH,
    registryExport: RTX_ATLAS_ASSET_REGISTRY_EXPORT,
    acceptedOutputs: [...RTX_ATLAS_ASSET_OUTPUT_TYPES],
    gouacheCategories: [...RTX_ATLAS_ASSET_GOUACHE_CATEGORIES],
    assetCatalogTags: [...RTX_ATLAS_ASSET_ENGINE_TAGS],
    existingAssets: assets.map((asset) => ({
      key: asset.key,
      name: asset.name,
      category: asset.category,
    })),
    styleguideExcerpt: [...RTX_ATLAS_ASSET_STYLEGUIDE_EXCERPT],
    assetCatalogExcerpt: [...RTX_ATLAS_ASSET_CATALOG_EXCERPT],
    rules: [
      "Use the Atlas pictogram styleguide as the visual and review source.",
      "Use the asset catalog for backlog tags and engine placement context.",
      "Return either a json-recipe object or png-fallback metadata.",
      "Do not return JavaScript, TypeScript, JSX, TSX, HTML, scripts, or functions.",
      "RTX proposals are review inputs and must not auto-apply.",
    ],
  };
}

export function formatRtxAtlasAssetPromptContext(
  context: RtxAtlasAssetPromptContext = buildRtxAtlasAssetPromptContext(),
): string {
  const existingAssets = context.existingAssets
    .map((asset) => `${asset.key} (${asset.category}: ${asset.name})`)
    .join(", ");

  return [
    "Atlas RTX Gouache asset context:",
    `- Styleguide: ${context.styleguidePath}`,
    `- Asset catalog/backlog: ${context.assetCatalogPath}`,
    `- Existing registry: ${context.registryExport}`,
    `- Accepted outputs: ${context.acceptedOutputs.join(", ")}`,
    `- Gouache categories: ${context.gouacheCategories.join(", ")}`,
    `- Asset catalog engine tags: ${context.assetCatalogTags.join(", ")}`,
    `- Existing Gouache assets: ${existingAssets || "none"}`,
    `- Styleguide excerpt: ${context.styleguideExcerpt.join(" ")}`,
    `- Asset catalog excerpt: ${context.assetCatalogExcerpt.join(" ")}`,
    "- Security: JSON recipe data or PNG fallback metadata only; no executable code.",
    "- Review flow: return a proposal for UWE validation, not an auto-applied asset.",
  ].join("\n");
}
