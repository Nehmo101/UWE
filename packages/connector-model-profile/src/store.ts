import { z } from "zod";

import { CONNECTOR_MODEL_TYPES, type ConnectorModelType } from "@uwe/connector";

import { modelProfileKey } from "./key";
import {
  CONNECTOR_MODEL_SOURCES,
  MODEL_PROFILE_STORE_VERSION,
  type ConnectorModelProfile,
  type ConnectorModelProfileStore,
  type ConnectorModelSource,
  type ModelScanPath,
} from "./types";

export class ConnectorModelProfileError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n"));
    this.name = "ConnectorModelProfileError";
    this.issues = issues;
  }
}

const sourceSchema = z.enum(CONNECTOR_MODEL_SOURCES);
const modelTypeSchema = z.enum(CONNECTOR_MODEL_TYPES);

const stringArray = z
  .array(z.unknown())
  .transform((values) =>
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function asTrimmedString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNullablePath(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSource(value: unknown): ConnectorModelSource {
  const parsed = sourceSchema.safeParse(typeof value === "string" ? value.trim() : value);
  return parsed.success ? parsed.data : "manual";
}

function normalizeModelType(value: unknown): ConnectorModelType {
  const parsed = modelTypeSchema.safeParse(typeof value === "string" ? value.trim() : value);
  return parsed.success ? parsed.data : "other";
}

export interface CreateModelProfileInput {
  provider: string;
  name: string;
  source?: ConnectorModelSource;
  displayName?: string;
  description?: string;
  bestFor?: string[];
  notRecommendedFor?: string[];
  modelType?: ConnectorModelType;
  path?: string | null;
  repoId?: string | null;
  enabledForUwe?: boolean;
  visibleInModelPicker?: boolean;
  tags?: string[];
  contextLength?: number | null;
  estimatedVramGb?: number | null;
  sizeBytes?: number | null;
}

/**
 * Build a fully-populated profile from partial input, applying safe defaults.
 * New profiles are disabled for UWE by default — the user opts a model in.
 */
export function createModelProfile(input: CreateModelProfileInput): ConnectorModelProfile {
  const provider = input.provider.trim();
  const name = input.name.trim();
  const path = input.path ? input.path.trim() : null;

  return {
    id: modelProfileKey(provider, name, path),
    provider,
    source: input.source ?? "manual",
    name,
    displayName: input.displayName?.trim() || name,
    description: input.description?.trim() ?? "",
    bestFor: dedupeStrings(input.bestFor ?? []),
    notRecommendedFor: dedupeStrings(input.notRecommendedFor ?? []),
    modelType: input.modelType ?? "other",
    path,
    repoId: input.repoId?.trim() || null,
    enabledForUwe: input.enabledForUwe ?? false,
    visibleInModelPicker: input.visibleInModelPicker ?? true,
    tags: dedupeStrings(input.tags ?? []),
    contextLength: nullableFiniteNumber(input.contextLength),
    estimatedVramGb: nullableFiniteNumber(input.estimatedVramGb),
    sizeBytes: nullableFiniteNumber(input.sizeBytes),
  };
}

function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

/** Default empty store for a fresh connector install. */
export function defaultModelProfileStore(): ConnectorModelProfileStore {
  return {
    version: MODEL_PROFILE_STORE_VERSION,
    profiles: [],
    scanPaths: [],
  };
}

function normalizeProfile(raw: Record<string, unknown>): ConnectorModelProfile | null {
  const provider = asTrimmedString(raw.provider);
  const name = asTrimmedString(raw.name);
  if (!provider || !name) {
    return null;
  }
  const path = asNullablePath(raw.path);

  return {
    id: modelProfileKey(provider, name, path),
    provider,
    source: normalizeSource(raw.source),
    name,
    displayName: asTrimmedString(raw.displayName) || name,
    description: asTrimmedString(raw.description),
    bestFor: stringArray.parse(Array.isArray(raw.bestFor) ? raw.bestFor : []),
    notRecommendedFor: stringArray.parse(
      Array.isArray(raw.notRecommendedFor) ? raw.notRecommendedFor : [],
    ),
    modelType: normalizeModelType(raw.modelType),
    path,
    repoId: asNullablePath(raw.repoId),
    enabledForUwe: asBoolean(raw.enabledForUwe, false),
    visibleInModelPicker: asBoolean(raw.visibleInModelPicker, true),
    tags: stringArray.parse(Array.isArray(raw.tags) ? raw.tags : []),
    contextLength: nullableFiniteNumber(raw.contextLength),
    estimatedVramGb: nullableFiniteNumber(raw.estimatedVramGb),
    sizeBytes: nullableFiniteNumber(raw.sizeBytes),
  };
}

function normalizeScanPath(raw: Record<string, unknown>, index: number): ModelScanPath | null {
  const path = asTrimmedString(raw.path);
  if (!path) {
    return null;
  }
  const id = asTrimmedString(raw.id) || `scan-${index}`;
  const label = asTrimmedString(raw.label);
  return {
    id,
    path,
    enabled: asBoolean(raw.enabled, true),
    label: label ? label : null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a persisted model store JSON value. Unknown keys are ignored, missing
 * keys receive defaults, and malformed entries are dropped rather than throwing,
 * so a partially corrupt file never breaks the connector. Throws only when the
 * top-level value is present but not a JSON object.
 */
export function parseModelProfileStore(json: unknown): ConnectorModelProfileStore {
  if (json === null || json === undefined) {
    return defaultModelProfileStore();
  }
  if (!isPlainObject(json)) {
    throw new ConnectorModelProfileError(["Model-Store muss ein JSON-Objekt sein."]);
  }

  const profilesRaw = Array.isArray(json.profiles) ? json.profiles : [];
  const scanPathsRaw = Array.isArray(json.scanPaths) ? json.scanPaths : [];

  const seenProfiles = new Set<string>();
  const profiles: ConnectorModelProfile[] = [];
  for (const entry of profilesRaw) {
    if (!isPlainObject(entry)) continue;
    const profile = normalizeProfile(entry);
    if (profile && !seenProfiles.has(profile.id)) {
      seenProfiles.add(profile.id);
      profiles.push(profile);
    }
  }

  const seenScan = new Set<string>();
  const scanPaths: ModelScanPath[] = [];
  scanPathsRaw.forEach((entry, index) => {
    if (!isPlainObject(entry)) return;
    const scanPath = normalizeScanPath(entry, index);
    if (scanPath && !seenScan.has(scanPath.id)) {
      seenScan.add(scanPath.id);
      scanPaths.push(scanPath);
    }
  });

  return {
    version: typeof json.version === "number" ? json.version : MODEL_PROFILE_STORE_VERSION,
    profiles,
    scanPaths,
  };
}

/** Profiles the user has enabled for UWE, in stable order. */
export function enabledProfiles(
  store: ConnectorModelProfileStore,
): ConnectorModelProfile[] {
  return store.profiles.filter((profile) => profile.enabledForUwe);
}
