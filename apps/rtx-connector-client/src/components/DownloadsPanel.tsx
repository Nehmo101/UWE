import { useEffect, useMemo, useState } from "react";

import { invoke } from "@tauri-apps/api/core";
import {
  createModelProfile,
  parseModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import type { OllamaPullEvent, PullOllamaModelResult } from "../lib/tauri";
import { useOllamaPullProgress } from "../lib/useOllamaPullProgress";

type Props = {
  loaded: boolean;
  store: ConnectorModelProfileStore;
  onLoadStore: () => Promise<ConnectorModelProfileStore>;
  onPullModel: (name: string) => Promise<PullOllamaModelResult>;
};

function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Unbekannter Fehler";
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Unbekannter Fehler";
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function describePull(result: PullOllamaModelResult | null): string | null {
  if (!result || result.events.length === 0) {
    return null;
  }

  const last = result.events[result.events.length - 1];
  if (last.type === "done") {
    return `Download abgeschlossen: ${last.name}`;
  }

  const percent =
    typeof last.fraction === "number" ? ` (${Math.round(last.fraction * 100)} %)` : "";
  return `${last.status || "Lädt"}${percent}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function parseDownloadEvents(raw: unknown): OllamaPullEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const events: OllamaPullEvent[] = [];
  for (const entry of raw) {
    const value = asRecord(entry);
    if (value.type === "done" && typeof value.name === "string") {
      events.push({ type: "done", name: value.name });
      continue;
    }

    if (value.type === "progress") {
      events.push({
        type: "progress",
        status: typeof value.status === "string" ? value.status : "",
        digest: typeof value.digest === "string" ? value.digest : undefined,
        total: typeof value.total === "number" ? value.total : undefined,
        completed: typeof value.completed === "number" ? value.completed : undefined,
        fraction: typeof value.fraction === "number" ? value.fraction : undefined,
      });
    }
  }

  return events;
}

function parseDownloadResult(raw: unknown): PullOllamaModelResult {
  const value = asRecord(raw);
  return {
    events: parseDownloadEvents(value.events),
    store: parseModelProfileStore(value.store),
  };
}

async function pullHuggingFaceModel(
  repoId: string,
  filename: string,
  revision: string,
): Promise<PullOllamaModelResult> {
  return parseDownloadResult(
    await invoke<unknown>("pull_huggingface_model", {
      repoId,
      filename,
      revision: revision.trim() || null,
    }),
  );
}

export function DownloadsPanel({ loaded, store, onLoadStore, onPullModel }: Props) {
  const [modelName, setModelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PullOllamaModelResult | null>(null);
  const [hfRepoId, setHfRepoId] = useState("");
  const [hfFilename, setHfFilename] = useState("");
  const [hfRevision, setHfRevision] = useState("main");
  const [hfBusy, setHfBusy] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [hfNotice, setHfNotice] = useState<string | null>(null);
  const [lastHfResult, setLastHfResult] = useState<PullOllamaModelResult | null>(null);
  const { progress: pullProgress, reset: resetPullProgress } = useOllamaPullProgress();

  useEffect(() => {
    if (!loaded) {
      void onLoadStore().catch(() => undefined);
    }
  }, [loaded, onLoadStore]);

  const ollamaProfiles = useMemo(
    () =>
      [...store.profiles]
        .filter((profile) => profile.provider === "ollama")
        .sort((left, right) => left.name.localeCompare(right.name, "de")),
    [store.profiles],
  );

  const huggingFaceProfiles = useMemo(
    () =>
      [...store.profiles]
        .filter((profile) => profile.provider === "huggingface")
        .sort((left, right) => left.name.localeCompare(right.name, "de")),
    [store.profiles],
  );

  async function runPull() {
    setBusy(true);
    setError(null);
    setNotice(null);
    resetPullProgress();

    try {
      const result = await onPullModel(modelName);
      setLastResult(result);
      setNotice(`Model-Store aktualisiert: ${result.store.profiles.length} Profile verfügbar.`);
      setModelName("");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  async function runHuggingFacePull() {
    const repoId = hfRepoId.trim();
    const filename = hfFilename.trim();
    const revision = hfRevision.trim() || "main";

    setHfBusy(true);
    setHfError(null);
    setHfNotice(null);

    try {
      if (!isTauriRuntime()) {
        const profile = createModelProfile({
          provider: "huggingface",
          source: "manual",
          name: filename,
          displayName: filename.split(/[\\/]/).pop() || filename,
          description: `Browser-Vorschauprofil für ${repoId} (${revision}).`,
          modelType: filename.toLowerCase().includes("embed") ? "embedding" : "chat",
          repoId,
          tags: ["huggingface", revision],
        });
        const nextStore = {
          ...store,
          profiles: [...store.profiles.filter((entry) => entry.id !== profile.id), profile],
        };
        setLastHfResult({
          events: [
            { type: "progress", status: "Browser-Vorschau", fraction: 0.5 },
            { type: "done", name: profile.name },
          ],
          store: nextStore,
        });
        setHfNotice("Browser-Vorschau: Hugging-Face-Profil simuliert.");
        return;
      }

      const result = await pullHuggingFaceModel(repoId, filename, revision);
      setLastHfResult(result);
      await onLoadStore();
      setHfNotice(`Hugging-Face-Download gespeichert: ${result.store.profiles.length} Profile verfügbar.`);
      setHfFilename("");
    } catch (nextError) {
      setHfError(toMessage(nextError));
    } finally {
      setHfBusy(false);
    }
  }

  const progressMessage = describePull(lastResult);
  const hfProgressMessage = describePull(lastHfResult);

  return (
    <div className="connector-grid connector-grid-2">
      <CardV2
        title="Ollama pull"
        footer={
          <div className="connector-actions">
            <ButtonV2
              variant="primary"
              onClick={runPull}
              disabled={busy || modelName.trim().length === 0}
            >
              Modell laden
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Zieht ein Modell direkt über den lokalen Ollama-Daemon. Der UWE Host sieht nur die freigegebenen Metadaten.
          </p>

          <label className="connector-field connector-field-full">
            <span>Ollama-Modellname</span>
            <input
              className="connector-input"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder="llama3.1:8b"
            />
          </label>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          {busy && pullProgress ? (
            <div className="connector-stack">
              <progress
                className="connector-progress"
                value={pullProgress.fraction ?? undefined}
                max={1}
              />
              <p className="connector-muted">
                {pullProgress.status || "Lädt …"}
                {typeof pullProgress.fraction === "number"
                  ? ` (${Math.round(pullProgress.fraction * 100)} %)`
                  : ""}
              </p>
            </div>
          ) : progressMessage ? (
            <HealthBadge status="ok" label={progressMessage} />
          ) : (
            <div className="connector-empty-state">Noch kein Pull ausgeführt.</div>
          )}
        </div>
      </CardV2>

      <CardV2
        title="Hugging Face"
        footer={
          <div className="connector-actions">
            <ButtonV2
              variant="primary"
              onClick={runHuggingFacePull}
              disabled={hfBusy || hfRepoId.trim().length === 0 || hfFilename.trim().length === 0}
            >
              Datei laden
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Lädt Modell-Dateien direkt vom Hugging-Face-Hub in den lokalen Connector-Speicher und legt ein Profil im Model-Store an.
          </p>

          <label className="connector-field connector-field-full">
            <span>Repository</span>
            <input
              className="connector-input"
              value={hfRepoId}
              onChange={(event) => setHfRepoId(event.target.value)}
              placeholder="Qwen/Qwen2.5-Coder-7B-Instruct-GGUF"
            />
          </label>

          <label className="connector-field connector-field-full">
            <span>Datei</span>
            <input
              className="connector-input"
              value={hfFilename}
              onChange={(event) => setHfFilename(event.target.value)}
              placeholder="qwen2.5-coder-7b-instruct-q4_k_m.gguf"
            />
          </label>

          <label className="connector-field connector-field-full">
            <span>Revision</span>
            <input
              className="connector-input"
              value={hfRevision}
              onChange={(event) => setHfRevision(event.target.value)}
              placeholder="main"
            />
          </label>

          {hfError ? <div className="connector-banner connector-banner-error">{hfError}</div> : null}
          {hfNotice ? <div className="connector-banner connector-banner-success">{hfNotice}</div> : null}

          {hfProgressMessage ? (
            <HealthBadge status="ok" label={hfProgressMessage} />
          ) : (
            <div className="connector-empty-state">Noch kein Hugging-Face-Download ausgeführt.</div>
          )}
        </div>
      </CardV2>

      <CardV2 title="Lokale Modell-Profile" className="connector-grid-span-2">
        <div className="connector-stack">
          <div className="connector-stats-row">
            <div className="connector-stat-pill">Ollama: {ollamaProfiles.length}</div>
            <div className="connector-stat-pill">Hugging Face: {huggingFaceProfiles.length}</div>
            <div className="connector-stat-pill">
              Für UWE aktiv: {store.profiles.filter((profile) => profile.enabledForUwe).length}
            </div>
          </div>

          {ollamaProfiles.length === 0 && huggingFaceProfiles.length === 0 ? (
            <div className="connector-empty-state">
              Noch keine Download-Profile im Store. Nutze oben einen Pull oder lade eine Hugging-Face-Datei.
            </div>
          ) : (
            <div className="connector-profile-list">
              {[...ollamaProfiles, ...huggingFaceProfiles].map((profile) => (
                <div key={profile.id} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <div>
                      <p className="connector-lead">{profile.displayName || profile.name}</p>
                      <p className="connector-muted">
                        {profile.provider === "huggingface" && profile.repoId
                          ? `${profile.repoId} · ${profile.path ?? profile.name}`
                          : profile.name}
                      </p>
                    </div>
                    <HealthBadge
                      status={profile.enabledForUwe ? "ok" : "degraded"}
                      label={profile.enabledForUwe ? "Freigegeben" : "Nur lokal"}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardV2>
    </div>
  );
}
