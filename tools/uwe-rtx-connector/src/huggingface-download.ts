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

  try {
    onProgress?.({ status: "Download gestartet", total, completed, fraction: total ? 0 : undefined });

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      const chunk = Buffer.from(value);
      completed += chunk.byteLength;
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
  } catch (error) {
    writer.destroy();
    rmSync(tempPath, { force: true });
    throw error;
  } finally {
    reader.releaseLock();
  }

  writer.end();
  await once(writer, "finish");
  renameSync(tempPath, targetPath);
  return statSync(targetPath).size;
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

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/octet-stream",
      ...authHeaders(process.env),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Hugging-Face-Download HTTP ${response.status}: ${body.slice(0, 240)}`);
  }

  const sizeBytes = await writeResponseBody(response, targetPath, onProgress);
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
