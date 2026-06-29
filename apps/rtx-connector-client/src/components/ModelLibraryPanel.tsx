import { useEffect, useMemo, useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

type Props = {
  loaded: boolean;
  store: ConnectorModelProfileStore;
  onLoadStore: () => Promise<ConnectorModelProfileStore>;
  onSaveStore: (store: ConnectorModelProfileStore) => Promise<ConnectorModelProfileStore>;
  onScanModels: () => Promise<ConnectorModelProfileStore>;
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

function createScanPathId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ModelLibraryPanel({
  loaded,
  store,
  onLoadStore,
  onSaveStore,
  onScanModels,
}: Props) {
  const [draft, setDraft] = useState(store);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraft(store);
  }, [store]);

  useEffect(() => {
    if (loaded) {
      return;
    }

    void (async () => {
      setBusyAction("load");
      setError(null);
      try {
        const next = await onLoadStore();
        setDraft(next);
      } catch (nextError) {
        setError(toMessage(nextError));
      } finally {
        setBusyAction(null);
      }
    })();
  }, [loaded, onLoadStore]);

  const stats = useMemo(() => {
    const enabled = draft.profiles.filter((profile) => profile.enabledForUwe).length;
    const filesystem = draft.profiles.filter((profile) => profile.path).length;
    return {
      total: draft.profiles.length,
      enabled,
      discoveredOnly: draft.profiles.length - enabled,
      filesystem,
    };
  }, [draft.profiles]);

  function updateScanPath(
    scanPathId: string,
    field: "label" | "path" | "enabled",
    value: boolean | string,
  ) {
    setDraft((current) => ({
      ...current,
      scanPaths: current.scanPaths.map((scanPath) =>
        scanPath.id === scanPathId ? { ...scanPath, [field]: value } : scanPath,
      ),
    }));
  }

  function addScanPath() {
    setDraft((current) => ({
      ...current,
      scanPaths: [
        ...current.scanPaths,
        {
          id: createScanPathId(),
          label: "",
          path: "",
          enabled: true,
        },
      ],
    }));
  }

  function removeScanPath(scanPathId: string) {
    setDraft((current) => ({
      ...current,
      scanPaths: current.scanPaths.filter((scanPath) => scanPath.id !== scanPathId),
    }));
  }

  async function savePaths() {
    setBusyAction("save");
    setError(null);
    setNotice(null);

    try {
      const saved = await onSaveStore(draft);
      setDraft(saved);
      setNotice("Scan-Pfade gespeichert.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveAndScan() {
    setBusyAction("scan");
    setError(null);
    setNotice(null);

    try {
      const saved = await onSaveStore(draft);
      setDraft(saved);
      const scanned = await onScanModels();
      setDraft(scanned);
      setNotice(`${scanned.profiles.length} Profile im Model-Store verfügbar.`);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  const sortedProfiles = [...draft.profiles].sort((left, right) =>
    (left.displayName || left.name).localeCompare(right.displayName || right.name, "de"),
  );

  return (
    <div className="connector-grid connector-grid-2">
      <CardV2
        title="Scan-Pfade"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="secondary" onClick={addScanPath} disabled={busyAction !== null}>
              Pfad hinzufügen
            </ButtonV2>
            <ButtonV2 variant="ghost" onClick={savePaths} disabled={busyAction !== null}>
              Speichern
            </ButtonV2>
            <ButtonV2 variant="primary" onClick={saveAndScan} disabled={busyAction !== null}>
              Jetzt scannen
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            GGUF-Verzeichnisse werden lokal auf dem RTX-PC gescannt und nie über den Host geladen.
          </p>
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          {draft.scanPaths.length === 0 ? (
            <div className="connector-empty-state">
              Noch keine Scan-Pfade hinterlegt. Füge lokale Modellordner hinzu oder scanne nur laufende Provider.
            </div>
          ) : (
            <div className="connector-stack">
              {draft.scanPaths.map((scanPath) => (
                <div key={scanPath.id} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <HealthBadge
                      status={scanPath.enabled ? "ok" : "degraded"}
                      label={scanPath.enabled ? "Aktiv" : "Pausiert"}
                    />
                    <ButtonV2
                      variant="ghost"
                      onClick={() => removeScanPath(scanPath.id)}
                      disabled={busyAction !== null}
                    >
                      Entfernen
                    </ButtonV2>
                  </div>

                  <div className="connector-form-grid">
                    <label className="connector-field">
                      <span>Label</span>
                      <input
                        className="connector-input"
                        value={scanPath.label ?? ""}
                        onChange={(event) => updateScanPath(scanPath.id, "label", event.target.value)}
                        placeholder="z. B. Modelle D:"
                      />
                    </label>

                    <label className="connector-field">
                      <span>Pfad</span>
                      <input
                        className="connector-input"
                        value={scanPath.path}
                        onChange={(event) => updateScanPath(scanPath.id, "path", event.target.value)}
                        placeholder="D:\\AI\\models"
                      />
                    </label>
                  </div>

                  <label className="connector-checkbox">
                    <input
                      type="checkbox"
                      checked={scanPath.enabled}
                      onChange={(event) => updateScanPath(scanPath.id, "enabled", event.target.checked)}
                    />
                    <span>Pfad beim Scan berücksichtigen</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardV2>

      <CardV2 title="Gefundene Profile">
        <div className="connector-stack">
          <div className="connector-stats-row">
            <div className="connector-stat-pill">Profile: {stats.total}</div>
            <div className="connector-stat-pill">Für UWE aktiv: {stats.enabled}</div>
            <div className="connector-stat-pill">Filesystem: {stats.filesystem}</div>
          </div>

          {sortedProfiles.length === 0 ? (
            <div className="connector-empty-state">
              Noch keine Profile im Store. Nutze „Jetzt scannen“ oder ziehe ein Modell per Ollama.
            </div>
          ) : (
            <div className="connector-profile-list">
              {sortedProfiles.map((profile) => (
                <div key={profile.id} className="connector-inline-card">
                  <div className="connector-inline-card-header">
                    <div>
                      <p className="connector-lead">{profile.displayName || profile.name}</p>
                      <p className="connector-muted">
                        {profile.provider} · {profile.modelType} · {profile.source}
                      </p>
                    </div>
                    <HealthBadge
                      status={profile.enabledForUwe ? "ok" : "degraded"}
                      label={profile.enabledForUwe ? "Für UWE aktiv" : "Nur lokal"}
                    />
                  </div>

                  <dl className="connector-kv connector-kv-compact">
                    <div>
                      <dt>Name</dt>
                      <dd>{profile.name}</dd>
                    </div>
                    <div>
                      <dt>Pfad</dt>
                      <dd>{profile.path ?? "Provider-Discovery"}</dd>
                    </div>
                    <div>
                      <dt>Anzeigename</dt>
                      <dd>{profile.displayName || "—"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardV2>
    </div>
  );
}
