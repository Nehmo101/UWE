import { useEffect, useMemo, useState } from "react";

import { invoke } from "@tauri-apps/api/core";
import {
  createModelProfile,
  parseModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import { HealthBadge } from "@uwe/shared-ui";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

import type { OllamaPullEvent, PullOllamaModelResult } from "../lib/tauri";
import { useOllamaMultiPullProgress } from "../lib/useOllamaMultiPullProgress";

type Props = {
  loaded: boolean;
  store: ConnectorModelProfileStore;
  onLoadStore: () => Promise<ConnectorModelProfileStore>;
  onPullModel: (name: string) => Promise<PullOllamaModelResult>;
  onDeleteModel: (name: string) => Promise<ConnectorModelProfileStore>;
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

/**
 * Split the free-text model field into a clean, de-duplicated list. Users may
 * separate names by newlines, commas or whitespace so several models can be
 * pulled at once (e.g. pasting a block of names).
 */
function parseModelNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const token of raw.split(/[\n,]+/)) {
    const name = token.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

type OllamaPullOutcome = { status: "running" | "done" | "error"; message?: string };

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

export function DownloadsPanel({ loaded, store, onLoadStore, onPullModel, onDeleteModel }: Props) {
  const [modelName, setModelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PullOllamaModelResult | null>(null);
  const [pullOutcomes, setPullOutcomes] = useState<Record<string, OllamaPullOutcome>>({});
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hfRepoId, setHfRepoId] = useState("");
  const [hfFilename, setHfFilename] = useState("");
  const [hfRevision, setHfRevision] = useState("main");
  const [hfBusy, setHfBusy] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [hfNotice, setHfNotice] = useState<string | null>(null);
  const [lastHfResult, setLastHfResult] = useState<PullOllamaModelResult | null>(null);
  const { entries: pullProgress, reset: resetPullProgress } = useOllamaMultiPullProgress();

  useEffect(() => {
    if (!loaded) {
      void onLoadStore().catch((nextError) => setError(toMessage(nextError)));
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
    const names = parseModelNames(modelName);
    if (names.length === 0) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    resetPullProgress(names);
    setPullOutcomes(Object.fromEntries(names.map((name) => [name, { status: "running" }])));

    // Kick every pull off at once — each is its own connector-CLI process, and
    // the Rust side tags progress events per model so they don't collide.
    const results = await Promise.all(
      names.map(async (name) => {
        try {
          const result = await onPullModel(name);
          setPullOutcomes((prev) => ({ ...prev, [name]: { status: "done" } }));
          return { name, ok: true as const, result };
        } catch (nextError) {
          const message = toMessage(nextError);
          setPullOutcomes((prev) => ({ ...prev, [name]: { status: "error", message } }));
          return { name, ok: false as const, message };
        }
      }),
    );

    const succeeded = results.filter((entry) => entry.ok);
    const failed = results.filter((entry) => !entry.ok);

    // Refresh the store from disk once, rather than trusting whichever parallel
    // pull's returned store happened to land last.
    let profileCount: number | null = null;
    if (succeeded.length > 0) {
      const lastOk = succeeded[succeeded.length - 1];
      if (lastOk.ok) {
        setLastResult(lastOk.result);
      }
      try {
        const refreshed = await onLoadStore();
        profileCount = refreshed.profiles.length;
      } catch {
        profileCount = null;
      }
    }

    if (failed.length > 0) {
      setError(
        `${failed.length} von ${names.length} Downloads fehlgeschlagen: ` +
          failed.map((entry) => entry.name).join(", "),
      );
    }
    if (succeeded.length > 0) {
      const storeNote = profileCount !== null ? ` — ${profileCount} Profile verfügbar.` : ".";
      setNotice(`${succeeded.length} von ${names.length} Modellen geladen${storeNote}`);
      if (failed.length === 0) {
        setModelName("");
      }
    }

    setBusy(false);
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

  async function deleteModel(name: string) {
    const confirmed = window.confirm(
      `„${name}“ wirklich löschen? Das Modell wird über Ollama entfernt und der Speicherplatz freigegeben.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingName(name);
    setDeleteError(null);
    try {
      await onDeleteModel(name);
    } catch (nextError) {
      setDeleteError(toMessage(nextError));
    } finally {
      setDeletingName(null);
    }
  }

  const progressMessage = describePull(lastResult);
  const hfProgressMessage = describePull(lastHfResult);
  const parsedModelNames = parseModelNames(modelName);
  const pullRows = Object.keys(pullOutcomes).map((name) => ({
    name,
    outcome: pullOutcomes[name],
    progress: pullProgress[name],
  }));

  return (
    <div className="connector-grid connector-grid-2">
      <Card>
        <CardHeader>
          <CardTitle>Ollama pull</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="connector-stack">
          <p className="connector-muted">
            Zieht Modelle direkt über den lokalen Ollama-Daemon. Mehrere Namen (pro Zeile oder
            per Komma getrennt) werden gleichzeitig geladen. Der UWE Host sieht nur die
            freigegebenen Metadaten.
          </p>

          <label className="connector-field connector-field-full">
            <span>Ollama-Modellnamen</span>
            <textarea
              className="connector-input"
              rows={3}
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder={"llama3.1:8b\nqwen2.5:14b\nmistral:7b"}
            />
          </label>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          {pullRows.length > 0 ? (
            <div className="connector-stack">
              {pullRows.map((row) => {
                const fraction = row.progress?.fraction;
                const isError = row.outcome.status === "error";
                const isDone = row.outcome.status === "done";
                const statusText = isError
                  ? row.outcome.message || "Fehlgeschlagen"
                  : isDone
                    ? "Fertig"
                    : row.progress?.status || "Lädt …";
                const percent =
                  typeof fraction === "number" ? ` (${Math.round(fraction * 100)} %)` : "";
                return (
                  <div key={row.name} className="connector-stack">
                    <div className="connector-inline-card-header">
                      <p className="connector-lead">{row.name}</p>
                      <HealthBadge
                        status={isError ? "error" : isDone ? "ok" : "degraded"}
                        label={isError ? "Fehler" : isDone ? "Fertig" : "Lädt …"}
                      />
                    </div>
                    <progress
                      className="connector-progress"
                      value={isDone ? 1 : fraction ?? undefined}
                      max={1}
                    />
                    <p className={isError ? "connector-banner connector-banner-error" : "connector-muted"}>
                      {statusText}
                      {isError ? "" : percent}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : progressMessage ? (
            <HealthBadge status="ok" label={progressMessage} />
          ) : (
            <div className="connector-empty-state">Noch kein Pull ausgeführt.</div>
          )}
        </div>
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button
              variant="primary"
              onClick={runPull}
              disabled={busy || parsedModelNames.length === 0}
            >
              {busy
                ? "Lädt …"
                : parsedModelNames.length > 1
                  ? `${parsedModelNames.length} Modelle laden`
                  : "Modell laden"}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hugging Face</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button
              variant="primary"
              onClick={runHuggingFacePull}
              disabled={hfBusy || hfRepoId.trim().length === 0 || hfFilename.trim().length === 0}
            >
              Datei laden
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card className="connector-grid-span-2">
        <CardHeader>
          <CardTitle>Lokale Modell-Profile</CardTitle>
        </CardHeader>
        <CardContent>
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

                  {profile.provider === "ollama" ? (
                    <div className="connector-actions">
                      <Button
                        variant="ghost"
                        onClick={() => void deleteModel(profile.name)}
                        disabled={deletingName !== null}
                      >
                        {deletingName === profile.name ? "Löscht …" : "Löschen"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {deleteError ? (
            <div className="connector-banner connector-banner-error">{deleteError}</div>
          ) : null}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
