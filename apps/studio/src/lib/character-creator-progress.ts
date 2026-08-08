import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const PROGRESS_REL = join(
  "packages",
  "character-creator",
  "dev-progress",
  "progress.json",
);

export interface CharacterCreatorProgressSummary {
  discoveredEntries: number;
  importedEntries: number;
  migratedEntries: number;
  duplicates: number;
  blockedEntries: number;
  excludedEntries?: number;
  unaccountedEntries?: number;
}

export interface CharacterCreatorWorkstream {
  id: string;
  name: string;
  agent: string;
  critic?: string;
  status: string;
  discoveredEntries: number;
  importedEntries: number;
  migratedEntries: number;
  duplicates: number;
  blockedEntries: number;
  openDefects: string[];
  nextAction: string;
  lastUpdate: string;
  criticVerdict: string | null;
}

export interface CharacterCreatorContentCategory {
  type: string;
  discovered: number;
  imported: number;
  blocked: number;
  duplicates: number;
  status: string;
}

export interface CharacterCreatorProgress {
  schemaVersion: number;
  title: string;
  updatedAt: string;
  modelsPolicy?: string;
  sourceRoot?: string;
  summary: CharacterCreatorProgressSummary;
  workstreams: CharacterCreatorWorkstream[];
  contentCategories: CharacterCreatorContentCategory[];
  openDefects: string[];
  failedTests: string[];
  screenshots: string[];
  criticVerdicts?: unknown[];
  nextActions: string[];
}

export interface WorkstreamCriticDefectObject {
  id?: string;
  severity?: string;
  summary: string;
}

export interface WorkstreamCriticFile {
  workstreamId: string;
  verdict: string;
  defects: string[] | WorkstreamCriticDefectObject[];
  acceptanceConditions?: string[];
  reviewedAt?: string;
  notes?: string;
}

export interface CharacterCreatorProgressView {
  progress: CharacterCreatorProgress | null;
  critics: Record<string, WorkstreamCriticFile>;
  devProgressRoot: string | null;
}

function findDevProgressRoot(): string | null {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    const progressPath = join(dir, PROGRESS_REL);
    if (existsSync(progressPath)) {
      return join(dir, "packages", "character-creator", "dev-progress");
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function readWorkstreamCritics(workstreamsDir: string): Record<string, WorkstreamCriticFile> {
  if (!existsSync(workstreamsDir)) {
    return {};
  }

  const critics: Record<string, WorkstreamCriticFile> = {};
  for (const entry of readdirSync(workstreamsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith("-critic.json")) {
      continue;
    }
    const critic = readJsonFile<WorkstreamCriticFile>(join(workstreamsDir, entry.name));
    if (critic?.workstreamId) {
      critics[critic.workstreamId] = critic;
    }
  }
  return critics;
}

export function loadCharacterCreatorProgress(): CharacterCreatorProgressView {
  const devProgressRoot = findDevProgressRoot();
  if (!devProgressRoot) {
    return { progress: null, critics: {}, devProgressRoot: null };
  }

  const progress = readJsonFile<CharacterCreatorProgress>(
    join(devProgressRoot, "progress.json"),
  );
  const critics = readWorkstreamCritics(join(devProgressRoot, "workstreams"));

  return { progress, critics, devProgressRoot };
}

export function formatCriticDefect(
  defect: string | WorkstreamCriticDefectObject,
): string {
  if (typeof defect === "string") {
    return defect;
  }
  const parts = [defect.summary];
  if (defect.severity) {
    parts.unshift(`[${defect.severity}]`);
  }
  return parts.join(" ");
}

export function resolveWorkstreamCriticVerdict(
  workstream: CharacterCreatorWorkstream,
  critic: WorkstreamCriticFile | undefined,
): string | null {
  if (workstream.criticVerdict) {
    return workstream.criticVerdict;
  }
  return critic?.verdict ?? null;
}
