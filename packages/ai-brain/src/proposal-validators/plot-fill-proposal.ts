/**
 * Review-only RTX/AI proposal shape for filling an Atlas `plot` feature.
 *
 * The model may suggest scatter parameters, but UWE owns geometry, visibility,
 * palette FK resolution, object creation, and final persistence.
 *
 * Moved out of `@uwe/atlas/plot-fill-proposal` (the 2D Atlas package is being
 * retired). `@uwe/ai-brain` is the only consumer; behaviour and every exported
 * name are unchanged. `BiomeKind` and `PlotFillAssetChoice` used to live in
 * sibling modules of the old package (`./constants`, `./plot-fill`) and are
 * inlined here because nothing outside this proposal shape referenced them.
 */

import { GOUACHE_ASSETS, GOUACHE_ASSET_KEYS } from "./gouache-registry";

/**
 * Semantic biome / climate kind for a filled polygon feature.
 * Was `@uwe/atlas/constants#BiomeKind`.
 */
export const BiomeKind = {
  forest: "forest",
  mountains: "mountains",
  hills: "hills",
  grassland: "grassland",
  desert: "desert",
  swamp: "swamp",
  coast: "coast",
  snow: "snow",
} as const;

export type BiomeKind = (typeof BiomeKind)[keyof typeof BiomeKind];

/**
 * One candidate asset in a plot-fill recipe.
 * Was `@uwe/atlas/plot-fill#PlotFillAssetChoice` — the scatter engine that
 * consumed it is part of the retired 2D editor; the proposal shape is not.
 */
export interface PlotFillAssetChoice {
  /** Gouache asset key persisted in `AtlasObject.style.gouache`. */
  gouacheKey: string;
  /** Relative selection weight. Defaults to 1. */
  weight?: number;
  /** Per-object scale range. Defaults to 0.78..1.22. */
  scaleMin?: number;
  scaleMax?: number;
  /** Per-object rotation range in degrees. Defaults to -12..12. */
  rotateMin?: number;
  rotateMax?: number;
  /** Optional default edge weight carried into object style. */
  lineWidth?: number;
  /** Optional default blur carried into object style. */
  blur?: number;
}

export const ATLAS_PLOT_FILL_PROPOSAL_KIND = "atlas_plot_fill" as const;
export const ATLAS_PLOT_FILL_SCHEMA_VERSION = 1 as const;

export interface AtlasPlotFillProposal {
  schemaVersion: typeof ATLAS_PLOT_FILL_SCHEMA_VERSION;
  kind: typeof ATLAS_PLOT_FILL_PROPOSAL_KIND;
  /** Optional client plot key for UI correlation. Not a DB identifier. */
  plotKey?: string;
  /** Optional semantic hint copied into the plot feature style by the reviewer. */
  biomeKind?: BiomeKind;
  /** Density multiplier. UWE clamps accepted proposals before object creation. */
  density: number;
  /** Deterministic seed for the plot-fill scatter. */
  seed: number;
  /** Gouache registry keys and bounded rendering hints. */
  assets: PlotFillAssetChoice[];
  /** Human-readable review note. Never executed or auto-applied. */
  notes?: string;
  rationale?: string;
}

export type AtlasPlotFillProposalIssueCode =
  | "invalid_type"
  | "invalid_value"
  | "missing_field"
  | "unexpected_field"
  | "executable_code";

export interface AtlasPlotFillProposalIssue {
  path: string;
  code: AtlasPlotFillProposalIssueCode;
  message: string;
}

export type AtlasPlotFillProposalValidationResult =
  | { ok: true; proposal: AtlasPlotFillProposal; warnings: string[] }
  | { ok: false; errors: AtlasPlotFillProposalIssue[] };

export interface AtlasPlotFillPromptContext {
  schemaVersion: typeof ATLAS_PLOT_FILL_SCHEMA_VERSION;
  kind: typeof ATLAS_PLOT_FILL_PROPOSAL_KIND;
  acceptedBiomes: BiomeKind[];
  acceptedGouacheAssets: Array<{ key: string; name: string; category: string }>;
  rules: string[];
}

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "kind",
  "plotKey",
  "biomeKind",
  "density",
  "seed",
  "assets",
  "notes",
  "rationale",
] as const;

const ASSET_KEYS = [
  "gouacheKey",
  "weight",
  "scaleMin",
  "scaleMax",
  "rotateMin",
  "rotateMax",
  "lineWidth",
  "blur",
] as const;

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
  "objects",
  "atlasobjects",
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

const SAFE_PLOT_KEY = /^[A-Za-z0-9:_-]{1,120}$/;
const GOUACHE_KEY_SET = new Set(GOUACHE_ASSET_KEYS);
const BIOME_VALUES = Object.values(BiomeKind) as BiomeKind[];

function add(
  issues: AtlasPlotFillProposalIssue[],
  path: string,
  code: AtlasPlotFillProposalIssueCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: AtlasPlotFillProposalIssue[],
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
  issues: AtlasPlotFillProposalIssue[],
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
      add(issues, `${path}.${key}`, "executable_code", `Executable/object field "${key}" is not accepted.`);
    }
    scanExecutable(entry, `${path}.${key}`, issues, seen);
  }
}

function stringValue(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasPlotFillProposalIssue[],
  opts: { max?: number; pattern?: RegExp } = {},
): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    add(issues, `${path}.${key}`, "invalid_type", `${key} must be a string.`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || (opts.max !== undefined && trimmed.length > opts.max) || (opts.pattern && !opts.pattern.test(trimmed))) {
    add(issues, `${path}.${key}`, "invalid_value", `${key} is empty or invalid.`);
    return undefined;
  }
  return trimmed;
}

function numberValue(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasPlotFillProposalIssue[],
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

function optionalNumber(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  issues: AtlasPlotFillProposalIssue[],
  opts: { min: number; max: number },
): number | undefined {
  return numberValue(raw, key, path, issues, opts);
}

function parseAsset(
  raw: unknown,
  path: string,
  issues: AtlasPlotFillProposalIssue[],
): PlotFillAssetChoice | null {
  if (!isRecord(raw)) {
    add(issues, path, "invalid_type", "assets entries must be objects.");
    return null;
  }
  const before = issues.length;
  rejectUnknown(raw, ASSET_KEYS, path, issues);

  const gouacheKey = stringValue(raw, "gouacheKey", path, issues, { max: 80 });
  if (!gouacheKey) add(issues, `${path}.gouacheKey`, "missing_field", "gouacheKey is required.");
  else if (!GOUACHE_KEY_SET.has(gouacheKey)) {
    add(issues, `${path}.gouacheKey`, "invalid_value", "Unknown Gouache asset key.");
  }

  const asset: PlotFillAssetChoice = { gouacheKey: gouacheKey ?? "" };
  const weight = optionalNumber(raw, "weight", path, issues, { min: 0.05, max: 10 });
  const scaleMin = optionalNumber(raw, "scaleMin", path, issues, { min: 0.2, max: 3 });
  const scaleMax = optionalNumber(raw, "scaleMax", path, issues, { min: 0.2, max: 3 });
  const rotateMin = optionalNumber(raw, "rotateMin", path, issues, { min: -180, max: 180 });
  const rotateMax = optionalNumber(raw, "rotateMax", path, issues, { min: -180, max: 180 });
  const lineWidth = optionalNumber(raw, "lineWidth", path, issues, { min: 0.3, max: 6 });
  const blur = optionalNumber(raw, "blur", path, issues, { min: 0, max: 8 });

  if (scaleMin !== undefined && scaleMax !== undefined && scaleMin > scaleMax) {
    add(issues, `${path}.scaleMin`, "invalid_value", "scaleMin must be <= scaleMax.");
  }
  if (rotateMin !== undefined && rotateMax !== undefined && rotateMin > rotateMax) {
    add(issues, `${path}.rotateMin`, "invalid_value", "rotateMin must be <= rotateMax.");
  }

  if (weight !== undefined) asset.weight = weight;
  if (scaleMin !== undefined) asset.scaleMin = scaleMin;
  if (scaleMax !== undefined) asset.scaleMax = scaleMax;
  if (rotateMin !== undefined) asset.rotateMin = rotateMin;
  if (rotateMax !== undefined) asset.rotateMax = rotateMax;
  if (lineWidth !== undefined) asset.lineWidth = lineWidth;
  if (blur !== undefined) asset.blur = blur;

  return issues.length === before && gouacheKey ? asset : null;
}

function parseAssets(
  raw: unknown,
  issues: AtlasPlotFillProposalIssue[],
): PlotFillAssetChoice[] {
  if (!Array.isArray(raw)) {
    add(issues, "$.assets", "invalid_type", "assets must be an array.");
    return [];
  }
  if (raw.length === 0) add(issues, "$.assets", "missing_field", "At least one asset is required.");
  if (raw.length > 12) add(issues, "$.assets", "invalid_value", "At most 12 assets are accepted.");
  return raw.slice(0, 12).flatMap((entry, index) => {
    const asset = parseAsset(entry, `$.assets[${index}]`, issues);
    return asset ? [asset] : [];
  });
}

export function validateAtlasPlotFillProposal(
  raw: unknown,
): AtlasPlotFillProposalValidationResult {
  const errors: AtlasPlotFillProposalIssue[] = [];
  scanExecutable(raw, "$", errors);
  if (!isRecord(raw)) {
    add(errors, "$", "invalid_type", "Proposal must be a JSON object.");
    return { ok: false, errors };
  }
  rejectUnknown(raw, TOP_LEVEL_KEYS, "$", errors);

  if (raw.schemaVersion !== undefined && raw.schemaVersion !== ATLAS_PLOT_FILL_SCHEMA_VERSION) {
    add(errors, "$.schemaVersion", "invalid_value", "schemaVersion must be 1.");
  }
  if (raw.kind !== undefined && raw.kind !== ATLAS_PLOT_FILL_PROPOSAL_KIND) {
    add(errors, "$.kind", "invalid_value", "kind must be atlas_plot_fill.");
  }

  const plotKey = stringValue(raw, "plotKey", "$", errors, { pattern: SAFE_PLOT_KEY });
  const biomeKind =
    typeof raw.biomeKind === "string" && (BIOME_VALUES as string[]).includes(raw.biomeKind)
      ? (raw.biomeKind as BiomeKind)
      : undefined;
  if (raw.biomeKind !== undefined && !biomeKind) {
    add(errors, "$.biomeKind", "invalid_value", "Unknown biome kind.");
  }
  const density = numberValue(raw, "density", "$", errors, { required: true, min: 0.05, max: 3 });
  const seed = numberValue(raw, "seed", "$", errors, { required: true, integer: true, min: 0, max: 0xffffffff });
  const assets = parseAssets(raw.assets, errors);
  const notes = stringValue(raw, "notes", "$", errors, { max: 500 });
  const rationale = stringValue(raw, "rationale", "$", errors, { max: 800 });

  if (errors.length > 0 || density === undefined || seed === undefined || assets.length === 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    proposal: {
      schemaVersion: ATLAS_PLOT_FILL_SCHEMA_VERSION,
      kind: ATLAS_PLOT_FILL_PROPOSAL_KIND,
      ...(plotKey ? { plotKey } : {}),
      ...(biomeKind ? { biomeKind } : {}),
      density,
      seed,
      assets,
      ...(notes ? { notes } : {}),
      ...(rationale ? { rationale } : {}),
    },
    warnings: [],
  };
}

export function isAtlasPlotFillProposal(raw: unknown): raw is AtlasPlotFillProposal {
  return validateAtlasPlotFillProposal(raw).ok;
}

export function buildAtlasPlotFillPromptContext(): AtlasPlotFillPromptContext {
  return {
    schemaVersion: ATLAS_PLOT_FILL_SCHEMA_VERSION,
    kind: ATLAS_PLOT_FILL_PROPOSAL_KIND,
    acceptedBiomes: [...BIOME_VALUES],
    acceptedGouacheAssets: GOUACHE_ASSETS.map((asset) => ({
      key: asset.key,
      name: asset.name,
      category: asset.category,
    })),
    rules: [
      "Return only JSON, no Markdown and no code.",
      "Use kind atlas_plot_fill and schemaVersion 1.",
      "Use only Gouache keys from acceptedGouacheAssets.",
      "Do not return AtlasObject payloads, coordinates, visibility, palette database ids, or executable code.",
      "UWE will create ghost objects from this recipe and requires explicit user review before persistence.",
    ],
  };
}

export function formatAtlasPlotFillPromptContext(
  context: AtlasPlotFillPromptContext = buildAtlasPlotFillPromptContext(),
): string {
  const assets = context.acceptedGouacheAssets
    .map((asset) => `${asset.key} (${asset.category}: ${asset.name})`)
    .join(", ");
  return [
    "Atlas plot-fill proposal context:",
    `- JSON shape: {"schemaVersion":1,"kind":"${context.kind}","biomeKind":"forest","density":1,"seed":123,"assets":[{"gouacheKey":"g_oak","weight":1}]}`,
    `- Accepted biomes: ${context.acceptedBiomes.join(", ")}`,
    `- Accepted Gouache assets: ${assets}`,
    "- Bounds: density 0.05..3, seed integer 0..4294967295, max 12 assets.",
    "- Security: no AtlasObject payloads, no code, no coordinates, no visibility, no palette database ids.",
    "- Review flow: RTX proposes a recipe only; UWE renders ghost objects and the DM must accept explicitly.",
  ].join("\n");
}
