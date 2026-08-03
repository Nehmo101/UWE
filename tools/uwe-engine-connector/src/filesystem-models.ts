/**
 * Filesystem model discovery — scan configured directories for `.gguf` files.
 *
 * Local model files (llama.cpp / LM Studio / Ollama imports) are often just
 * `.gguf` files in a folder. This scan lets the user surface those in the UWE
 * model picker even when no server is currently running. It is best-effort and
 * offline-safe: unreadable or missing directories are skipped silently.
 *
 * Only file metadata (name, path, size) is read — never file contents.
 */

import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import type { ConnectorModelType, ModelScanPath } from "@uwe/connector-model-profile";

const GGUF_EXTENSION = ".gguf";
const DEFAULT_MAX_DEPTH = 4;

export interface FilesystemModel {
  provider: "filesystem";
  /** File name without the `.gguf` extension. */
  name: string;
  /** Absolute path to the `.gguf` file. */
  path: string;
  sizeBytes: number;
  modelType: ConnectorModelType;
  scanPathId: string;
}

/** Heuristic model type from a file name (embedding models are common). */
export function inferFilesystemModelType(fileName: string): ConnectorModelType {
  const lower = fileName.toLowerCase();
  if (/embed|nomic|bge|minilm|gte|e5-/.test(lower)) {
    return "embedding";
  }
  if (/llava|vision|-vl|bakllava|moondream/.test(lower)) {
    return "vision";
  }
  return "chat";
}

function scanDirectory(
  dir: string,
  scanPathId: string,
  depth: number,
  seen: Set<string>,
  out: FilesystemModel[],
): void {
  if (depth > DEFAULT_MAX_DEPTH) {
    return;
  }

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Missing or unreadable directory — skip.
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, scanPathId, depth + 1, seen, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(GGUF_EXTENSION)) {
      continue;
    }
    if (seen.has(fullPath)) {
      continue;
    }

    let sizeBytes = 0;
    try {
      sizeBytes = statSync(fullPath).size;
    } catch {
      // Stat failed (race / permission) — still report with size 0.
    }

    seen.add(fullPath);
    out.push({
      provider: "filesystem",
      name: basename(entry.name, GGUF_EXTENSION),
      path: fullPath,
      sizeBytes,
      modelType: inferFilesystemModelType(entry.name),
      scanPathId,
    });
  }
}

/**
 * Scan every enabled scan path for `.gguf` files. Disabled paths are ignored.
 * Results are deduplicated by absolute path.
 */
export function scanFilesystemModels(scanPaths: readonly ModelScanPath[]): FilesystemModel[] {
  const out: FilesystemModel[] = [];
  const seen = new Set<string>();
  for (const scanPath of scanPaths) {
    if (!scanPath.enabled || !scanPath.path.trim()) {
      continue;
    }
    scanDirectory(scanPath.path, scanPath.id, 0, seen, out);
  }
  return out;
}
