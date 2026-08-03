import { once } from "node:events";
import {
  createWriteStream,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

import {
  createModelProfile,
  type ConnectorModelProfile,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";

import { inferFilesystemModelType } from "./filesystem-models";
import { loadModelProfileStore, saveModelProfileStore } from "./model-profile-store";

export interface HuggingFaceDownloadProgress {
  status: string;
  total?: number;
  completed?: number;
  fraction?: number;
}

export interface HuggingFaceDownloadResult {
  profile: ConnectorModelProfile;
  store: ConnectorModelProfileStore;
  path: string;
  sizeBytes: number;
}

const HUGGINGFACE_BASE_URL = "https://huggingface.co";
const DEFAULT_REVISION = "main";
const PROVIDER = "huggingface";
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/**
 * Idle timeout between received chunks. A full-download timeout would be wrong
 * for large models, so we abort only when the connection stalls (no data for
 * this many ms). Configurable via `UWE_HF_DOWNLOAD_IDLE_TIMEOUT_MS`.
 */
function resolveIdleTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env.UWE_HF_DOWNLOAD_IDLE_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_IDLE_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_TIMEOUT_MS;
}

function normalizeRepoId(value: string): string {
  const repoId = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repoId)) {
    throw new Error("Hugging-Face-Repo muss im Format owner/name angegeben werden.");
  }
  return repoId;
}

function normalizeRevision(value: string | undefined): string {
  const revision = value?.trim() || DEFAULT_REVISION;
  if (revision.includes("..") || /[\\/]/.test(revision)) {
    throw new Error("Hugging-Face-Revision darf keinen Pfad enthalten.");
  }
  return revision;
}

function normalizeFilename(value: string): string {
  const filename = value.trim().replace(/\\/g, "/");
  const parts = filename.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    throw new Error("Hugging-Face-Dateiname ist ungueltig.");
  }
  return parts.join("/");
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function buildResolveUrl(repoId: string, filename: string, revision: string): string {
  const encodedRepo = repoId.split("/").map(encodeURIComponent).join("/");
  const encodedFilename = filename.split("/").map(encodeURIComponent).join("/");
  return `${HUGGINGFACE_BASE_URL}/${encodedRepo}/resolve/${encodeURIComponent(revision)}/${encodedFilename}`;
}

function resolveTargetPath(dataDir: string, repoId: string, filename: string, revision: string): string {
  const root = resolve(dataDir, "models", "huggingface");
  const [owner, repo] = repoId.split("/");
  const target = resolve(
    root,
    safePathSegment(owner),
    safePathSegment(repo),
    safePathSegment(revision),
    ...filename.split("/").map(safePathSegment),
  );

  if (!target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`) && target !== root) {
    throw new Error("Hugging-Face-Zielpfad liegt ausserhalb des Model-Verzeichnisses.");
  }

  return target;
}

function authHeaders(env: NodeJS.ProcessEnv): HeadersInit {
  const token = env.HF_TOKEN?.trim() || env.HUGGINGFACE_HUB_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function writeResponseBody(
  response: Response,
  targetPath: string,
  onProgress?: (progress: HuggingFaceDownloadProgress) => void,
  onChunk?: () => void,
): Promise<number> {
  if (!response.body) {
    throw new Error("Hugging-Face-Download lieferte keinen Datenstrom.");
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.part`;
  rmSync(tempPath, { force: true });

  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? Number.parseInt(totalHeader, 10) : undefined;
  const writer = createWriteStream(tempPath, { flags: "w" });
  const reader = response.body.getReader();
  let completed = 0;

  // Capture asynchronous write-stream errors (disk full, permissions, I/O).
  // Without this listener Node would emit an unhandled 'error' event and crash
  // the whole connector process instead of failing just this download.
  let writerError: Error | null = null;
  const captureWriterError = (error: Error) => {
    writerError = error;
  };
  writer.on("error", captureWriterError);

  const throwIfWriterFailed = () => {
    if (writerError) {
      throw writerError;
    }
  };

  try {
    onProgress?.({ status: "Download gestartet", total, completed, fraction: total ? 0 : undefined });

    for (;;) {
      throwIfWriterFailed();
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      onChunk?.();

      const chunk = Buffer.from(value);
      completed += chunk.byteLength;
      throwIfWriterFailed();
      if (!writer.write(chunk)) {
        await once(writer, "drain");
      }

      onProgress?.({
        status: "Download laeuft",
        total,
        completed,
        fraction: total && total > 0 ? Math.max(0, Math.min(1, completed / total)) : undefined,
      });
    }

    throwIfWriterFailed();
    writer.end();
    await once(writer, "finish");
    throwIfWriterFailed();
    renameSync(tempPath, targetPath);
    return statSync(targetPath).size;
  } catch (error) {
    writer.destroy();
    // Wait for the stream to fully close before removing the temp file so a
    // pending async open/write cannot race the rm (and emit a stray ENOENT).
    await once(writer, "close").catch(() => {});
    rmSync(tempPath, { force: true });
    throw error;
  } finally {
    reader.releaseLock();
    writer.off("error", captureWriterError);
  }
}

function upsertProfile(
  store: ConnectorModelProfileStore,
  profile: ConnectorModelProfile,
): ConnectorModelProfileStore {
  const profiles = store.profiles.filter((entry) => entry.id !== profile.id);
  return { ...store, profiles: [...profiles, profile] };
}

export async function downloadHuggingFaceModel(
  dataDir: string,
  input: { repoId: string; filename: string; revision?: string },
  onProgress?: (progress: HuggingFaceDownloadProgress) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<HuggingFaceDownloadResult> {
  const repoId = normalizeRepoId(input.repoId);
  const filename = normalizeFilename(input.filename);
  const revision = normalizeRevision(input.revision);
  const url = buildResolveUrl(repoId, filename, revision);
  const targetPath = resolveTargetPath(dataDir, repoId, filename, revision);

  const idleTimeoutMs = resolveIdleTimeoutMs(process.env);
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdleTimeout = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.abort(
        new Error(`Hugging-Face-Download abgebrochen: seit ${idleTimeoutMs} ms keine Daten empfangen.`),
      );
    }, idleTimeoutMs);
  };

  let sizeBytes: number;
  try {
    armIdleTimeout();
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/octet-stream",
        ...authHeaders(process.env),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Hugging-Face-Download HTTP ${response.status}: ${body.slice(0, 240)}`);
    }

    sizeBytes = await writeResponseBody(response, targetPath, onProgress, armIdleTimeout);
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }

  const store = loadModelProfileStore(dataDir);
  const displayName = basename(filename);
  const profile = createModelProfile({
    provider: PROVIDER,
    source: "filesystem",
    name: displayName,
    displayName,
    description: `Hugging Face: ${repoId} (${revision})`,
    modelType: inferFilesystemModelType(displayName),
    path: targetPath,
    repoId,
    sizeBytes,
    tags: ["huggingface", revision],
    visibleInModelPicker: true,
    enabledForUwe: false,
  });
  const nextStore = upsertProfile(store, profile);
  saveModelProfileStore(dataDir, nextStore);

  return { profile, store: nextStore, path: targetPath, sizeBytes };
}
