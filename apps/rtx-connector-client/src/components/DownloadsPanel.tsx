import { useEffect, useMemo, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

import type { PullOllamaModelResult } from "../lib/tauri";

type Props = {
  loaded: boolean;
  store: ConnectorModelProfileStore;
  onLoadStore: () => Promise<ConnectorModelProfileStore>;
  onPullModel: (name: string) => Promise<PullOllamaModelResult>;
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
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

export function DownloadsPanel({ loaded, store, onLoadStore, onPullModel }: Props) {
  const [modelName, setModelName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PullOllamaModelResult | null>(null);

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

  async function runPull() {
    setBusy(true);
    setError(null);
    setNotice(null);

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

  const progressMessage = describePull(lastResult);

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

          {progressMessage ? (
            <HealthBadge status="ok" label={progressMessage} />
          ) : (
            <div className="connector-empty-state">Noch kein Pull ausgeführt.</div>
          )}
        </div>
      </CardV2>

      <CardV2 title="Lokale Ollama-Profile">
        <div className="connector-stack">
          <div className="connector-stats-row">
            <div className="connector-stat-pill">Modelle: {ollamaProfiles.length}</div>
            <div className="connector-stat-pill">
              Für UWE aktiv: {ollamaProfiles.filter((profile) => profile.enabledForUwe).length}
            </div>
          </div>

          {ollamaProfiles.length === 0 ? (
            <div className="connector-empty-state">
              Noch keine Ollama-Profile im Store. Nutze links einen Pull oder starte einen Scan.
            </div>
          ) : (
            <div className="connector-profile-list">
              {ollamaProfiles.map((profile) => (
                <div key={profile.id} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <div>
                      <p className="connector-lead">{profile.displayName || profile.name}</p>
                      <p className="connector-muted">{profile.name}</p>
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
