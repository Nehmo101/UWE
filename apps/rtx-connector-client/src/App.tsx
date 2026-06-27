import { useCallback, useEffect, useMemo, useState } from "react";

import {
  defaultConnectorClientConfig,
  maskToken,
  parseConnectorClientConfig,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
import {
  defaultModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import { CookbookPanel } from "./components/CookbookPanel";
import { DownloadsPanel } from "./components/DownloadsPanel";
import { JobsPanel } from "./components/JobsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { ModelLibraryPanel } from "./components/ModelLibraryPanel";
import { RunnersPanel } from "./components/RunnersPanel";
import { SecurityPanel } from "./components/SecurityPanel";
import { SectionPlaceholder } from "./components/SectionPlaceholder";
import { SetupWizard } from "./components/SetupWizard";
import { UweReleasePanel } from "./components/UweReleasePanel";
import {
  getConnectorStatus,
  getCookbookDashboard,
  getModelStore,
  listConnectorJobs,
  listConnectorLogs,
  probeRunners,
  pullOllamaModel,
  readConfig,
  saveModelStore,
  scanModels,
  startConnector,
  startOllama,
  stopConnector,
  testHostConnection,
  testRunner,
  writeConfig,
  type ConnectorRuntimeStatus,
  type HostConnectionTestResult,
  type RunnerId,
} from "./lib/tauri";

type Section = {
  id: string;
  label: string;
  phase: string;
  active: boolean;
  summary: string;
};

/** Product navigation — P0 active sections marked `active: true`. */
const NAV_SECTIONS: Section[] = [
  {
    id: "overview",
    label: "Übersicht",
    phase: "P0",
    active: true,
    summary: "Verbindungsstatus, Schnellaktionen und Connector-Kennzahlen.",
  },
  {
    id: "connection",
    label: "Verbindung",
    phase: "P0",
    active: true,
    summary: "Host URL, Connector-Token, Start/Stop und Verbindungstest.",
  },
  {
    id: "cookbook",
    label: "Cookbook",
    phase: "P2",
    active: true,
    summary: "Hardware-aware Modell-Empfehlungen aus @uwe/cookbook.",
  },
  {
    id: "downloads",
    label: "Downloads",
    phase: "P1",
    active: true,
    summary: "Ollama pull und lokaler Modell-Import.",
  },
  {
    id: "library",
    label: "Modell-Bibliothek",
    phase: "P1",
    active: true,
    summary: "Verzeichnisse scannen und Modellstatus verwalten.",
  },
  {
    id: "release",
    label: "UWE-Freigabe",
    phase: "P1",
    active: true,
    summary: "Modelle einzeln für UWE aktivieren und melden.",
  },
  {
    id: "runners",
    label: "Runner",
    phase: "P2",
    active: true,
    summary: "Ollama, LM Studio, llama.cpp erkennen und testen.",
  },
  {
    id: "spotify",
    label: "Spotify",
    phase: "P4",
    active: false,
    summary: "Spotify OAuth und Device-Verwaltung nur auf dem RTX-PC.",
  },
  {
    id: "audio",
    label: "Audio",
    phase: "P4",
    active: false,
    summary: "Lokale Audio-Befehle und Capability-Tests.",
  },
  {
    id: "image",
    label: "Bildgenerierung",
    phase: "P4",
    active: false,
    summary: "Image-Worker konfigurieren und testen.",
  },
  {
    id: "jobs",
    label: "Jobs",
    phase: "P1",
    active: true,
    summary: "Aktive und letzte Connector-Jobs nach Lane.",
  },
  {
    id: "logs",
    label: "Logs",
    phase: "P1",
    active: true,
    summary: "Redigierte Logs nach Kategorie exportieren.",
  },
  {
    id: "security",
    label: "Sicherheit",
    phase: "P2",
    active: true,
    summary: "Outbound-only, Token-Schutz und Privacy Mode.",
  },
  {
    id: "settings",
    label: "Einstellungen",
    phase: "P0",
    active: true,
    summary: "Tray, Autostart und Queue-Optionen.",
  },
];

const INITIAL_RUNTIME_STATUS: ConnectorRuntimeStatus = {
  status: "stopped",
  message: "Connector ist gestoppt.",
  connectionStatus: "not_configured",
  lastHeartbeatAt: null,
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function toHealthBadgeStatus(
  runtimeStatus: ConnectorRuntimeStatus,
): "ok" | "degraded" | "error" {
  if (runtimeStatus.status === "error" || runtimeStatus.connectionStatus === "error") {
    return "error";
  }

  if (runtimeStatus.status === "running" && runtimeStatus.connectionStatus === "connected") {
    return "ok";
  }

  return "degraded";
}

function humanizeConnectionStatus(status: ConnectorRuntimeStatus["connectionStatus"]): string {
  switch (status) {
    case "connected":
      return "Verbunden";
    case "connecting":
      return "Verbindet";
    case "ready":
      return "Bereit";
    case "degraded":
      return "Eingeschränkt";
    case "disconnected":
      return "Getrennt";
    case "error":
      return "Fehler";
    case "not_configured":
      return "Nicht eingerichtet";
    default:
      return status;
  }
}

function humanizeProcessStatus(status: ConnectorRuntimeStatus["status"]): string {
  switch (status) {
    case "running":
      return "Läuft";
    case "starting":
      return "Startet";
    case "stopping":
      return "Stoppt";
    case "error":
      return "Fehler";
    case "stopped":
    default:
      return "Gestoppt";
  }
}

export default function App() {
  const [selectedSectionId, setSelectedSectionId] = useState("overview");
  const [config, setConfig] = useState<ConnectorClientConfig>(defaultConnectorClientConfig());
  const [modelStore, setModelStore] = useState<ConnectorModelProfileStore>(defaultModelProfileStore());
  const [modelStoreLoaded, setModelStoreLoaded] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<ConnectorRuntimeStatus>(INITIAL_RUNTIME_STATUS);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HostConnectionTestResult | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const selectedSection = useMemo(
    () => NAV_SECTIONS.find((section) => section.id === selectedSectionId) ?? NAV_SECTIONS[0],
    [selectedSectionId],
  );

  const refreshFromBackend = useCallback(async () => {
    setBusyAction("refresh");
    setError(null);

    try {
      const [nextConfig, nextRuntimeStatus] = await Promise.all([readConfig(), getConnectorStatus()]);
      setConfig(nextConfig);
      setRuntimeStatus(nextRuntimeStatus);
      return { nextConfig, nextRuntimeStatus };
    } catch (nextError) {
      setError(toMessage(nextError));
      return null;
    } finally {
      setBusyAction(null);
    }
  }, []);

  const loadModelStore = useCallback(async () => {
    const nextStore = await getModelStore();
    setModelStore(nextStore);
    setModelStoreLoaded(true);
    return nextStore;
  }, []);

  const persistModelStore = useCallback(async (nextStore: ConnectorModelProfileStore) => {
    const saved = await saveModelStore(nextStore);
    setModelStore(saved);
    setModelStoreLoaded(true);
    return saved;
  }, []);

  const runModelScan = useCallback(async () => {
    const scanned = await scanModels();
    setModelStore(scanned);
    setModelStoreLoaded(true);
    return scanned;
  }, []);

  const runOllamaPull = useCallback(async (name: string) => {
    const result = await pullOllamaModel(name);
    setModelStore(result.store);
    setModelStoreLoaded(true);
    return result;
  }, []);

  const loadConnectorJobs = useCallback(async () => listConnectorJobs(), []);

  const loadConnectorLogs = useCallback(async (category?: string) => listConnectorLogs(category), []);

  const loadCookbookDashboard = useCallback(async () => getCookbookDashboard(), []);

  const enableModelForUwe = useCallback(async (name: string) => {
    let store = await getModelStore();
    const matches = (profile: ConnectorModelProfileStore["profiles"][number]) =>
      profile.provider === "ollama" && (profile.name === name || profile.displayName === name);

    if (!store.profiles.some(matches)) {
      const result = await pullOllamaModel(name);
      store = result.store;
    }

    const next: ConnectorModelProfileStore = {
      ...store,
      profiles: store.profiles.map((profile) =>
        matches(profile) ? { ...profile, enabledForUwe: true } : profile,
      ),
    };

    const saved = await saveModelStore(next);
    setModelStore(saved);
    setModelStoreLoaded(true);
  }, []);

  const probeRunnersList = useCallback(async () => probeRunners(), []);

  const runStartOllama = useCallback(async () => startOllama(), []);

  const runTestRunner = useCallback(async (id: RunnerId) => testRunner(id), []);

  useEffect(() => {
    void (async () => {
      const result = await refreshFromBackend();
      setBootstrapped(true);
      if (result && !result.nextConfig.wizardCompleted) {
        setShowWizard(true);
      }
    })();
  }, [refreshFromBackend]);

  function updateConfig<K extends keyof ConnectorClientConfig>(
    key: K,
    value: ConnectorClientConfig[K],
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  async function persistConfig() {
    setBusyAction("save");
    setError(null);
    setNotice(null);

    try {
      const normalizedConfig = parseConnectorClientConfig(config);
      const savedConfig = await writeConfig(normalizedConfig);
      const nextRuntimeStatus = await getConnectorStatus();

      setConfig(savedConfig);
      setRuntimeStatus(nextRuntimeStatus);
      setNotice("Lokale Konfiguration gespeichert.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function runHostTest() {
    setBusyAction("test");
    setError(null);
    setNotice(null);

    try {
      const result = await testHostConnection(config.hostUrl, config.token);
      setTestResult(result);
      setNotice(result.ok ? "Verbindungstest erfolgreich." : null);
      if (!result.ok) {
        setError(result.message);
      }
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function runStartConnector() {
    setBusyAction("start");
    setError(null);
    setNotice(null);

    try {
      await writeConfig(parseConnectorClientConfig(config));
      const nextRuntimeStatus = await startConnector();
      setRuntimeStatus(nextRuntimeStatus);
      setNotice("Connector-Core gestartet.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  async function runStopConnector() {
    setBusyAction("stop");
    setError(null);
    setNotice(null);

    try {
      const nextRuntimeStatus = await stopConnector();
      setRuntimeStatus(nextRuntimeStatus);
      setNotice("Connector-Core gestoppt.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  function renderOverview() {
    const isRunning = runtimeStatus.status === "running";

    return (
      <>
        <div className="connector-grid connector-grid-3">
          <CardV2 title="Verbindungsstatus">
            <div className="connector-stack">
              <HealthBadge
                status={toHealthBadgeStatus(runtimeStatus)}
                label={`${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
              />
              <p className="connector-muted">{runtimeStatus.message}</p>
              <dl className="connector-kv">
                <div>
                  <dt>Host</dt>
                  <dd>{config.hostUrl || "Nicht gesetzt"}</dd>
                </div>
                <div>
                  <dt>Connector</dt>
                  <dd>{config.name}</dd>
                </div>
                <div>
                  <dt>Letzter Heartbeat</dt>
                  <dd>{runtimeStatus.lastHeartbeatAt ?? "Noch keiner"}</dd>
                </div>
              </dl>
            </div>
          </CardV2>

          <CardV2 title="Steuerung">
            <div className="connector-stack">
              <p className="connector-muted">
                Startet und stoppt denselben Connector-Core wie <code>pnpm connector:start</code>.
              </p>
              <div className="connector-actions">
                {isRunning ? (
                  <ButtonV2 variant="accent" onClick={runStopConnector} disabled={busyAction !== null}>
                    Verbindung stoppen
                  </ButtonV2>
                ) : (
                  <ButtonV2 variant="primary" onClick={runStartConnector} disabled={busyAction !== null}>
                    Verbindung starten
                  </ButtonV2>
                )}
                <ButtonV2 variant="ghost" onClick={refreshFromBackend} disabled={busyAction !== null}>
                  Status aktualisieren
                </ButtonV2>
              </div>
            </div>
          </CardV2>

          <CardV2 title="Rollout">
            <div className="connector-stack">
              <p className="connector-stat">P2 aktiv</p>
              <p className="connector-muted">
                Zusätzlich zu P1 sind jetzt Cookbook-Empfehlungen, Runner-Erkennung und die
                Sicherheits-/Privacy-Ansicht nutzbar.
              </p>
              {!config.wizardCompleted ? (
                <ButtonV2 variant="secondary" onClick={() => setShowWizard(true)}>
                  Erststart-Wizard öffnen
                </ButtonV2>
              ) : null}
            </div>
          </CardV2>
        </div>

        <CardV2 title="Lokales Profil">
          <dl className="connector-kv">
            <div>
              <dt>Token</dt>
              <dd>{maskToken(config.token) || "Noch nicht gesetzt"}</dd>
            </div>
            <div>
              <dt>Queue</dt>
              <dd>{config.queueEnabled ? "Aktiv" : "Deaktiviert"}</dd>
            </div>
            <div>
              <dt>Wizard</dt>
              <dd>{config.wizardCompleted ? "Abgeschlossen" : "Ausstehend"}</dd>
            </div>
          </dl>
        </CardV2>
      </>
    );
  }

  function renderConnection() {
    return (
      <div className="connector-grid connector-grid-2">
        <CardV2
          title="Host und Connector-Token"
          footer={
            <div className="connector-actions">
              <ButtonV2 variant="primary" onClick={persistConfig} disabled={busyAction !== null}>
                Speichern
              </ButtonV2>
              <ButtonV2 variant="secondary" onClick={runHostTest} disabled={busyAction !== null}>
                Verbindung testen
              </ButtonV2>
            </div>
          }
        >
          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Connector-Name</span>
              <input
                className="connector-input"
                value={config.name}
                onChange={(event) => updateConfig("name", event.target.value)}
                placeholder="RTX Arbeitszimmer"
              />
            </label>

            <label className="connector-field">
              <span>UWE Host URL</span>
              <input
                className="connector-input"
                value={config.hostUrl}
                onChange={(event) => updateConfig("hostUrl", event.target.value)}
                placeholder="https://uwe.example.org"
              />
            </label>

            <label className="connector-field connector-field-full">
              <span>Connector-Token</span>
              <input
                className="connector-input"
                type="password"
                value={config.token}
                onChange={(event) => updateConfig("token", event.target.value)}
                placeholder="uwec_..."
              />
            </label>
          </div>
        </CardV2>

        <CardV2
          title="Outbound-Laufzeit"
          footer={
            <div className="connector-actions">
              <ButtonV2 variant="accent" onClick={runStartConnector} disabled={busyAction !== null}>
                Connector starten
              </ButtonV2>
              <ButtonV2 variant="ghost" onClick={runStopConnector} disabled={busyAction !== null}>
                Connector stoppen
              </ButtonV2>
            </div>
          }
        >
          <div className="connector-stack">
            <HealthBadge
              status={toHealthBadgeStatus(runtimeStatus)}
              label={`${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
            />
            <p className="connector-muted">{runtimeStatus.message}</p>
            <p className="connector-muted">
              Outbound-only: kein öffentlicher Port, kein SSH, kein DB-Zugriff auf dem RTX-PC.
            </p>
          </div>
        </CardV2>

        {testResult ? (
          <CardV2 title="Letzter Verbindungstest" className="connector-grid-span-2">
            <div className="connector-stack">
              <HealthBadge
                status={testResult.ok ? "ok" : "error"}
                label={testResult.ok ? "Erfolgreich" : "Fehlgeschlagen"}
              />
              <p className="connector-muted">{testResult.message}</p>
              <p className="connector-muted">Geprüft: {testResult.checkedAt}</p>
            </div>
          </CardV2>
        ) : null}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="connector-grid connector-grid-2">
        <CardV2
          title="Client-Optionen"
          footer={
            <div className="connector-actions">
              <ButtonV2 variant="primary" onClick={persistConfig} disabled={busyAction !== null}>
                Einstellungen speichern
              </ButtonV2>
            </div>
          }
        >
          <div className="connector-form-grid">
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.queueEnabled}
                onChange={(event) => updateConfig("queueEnabled", event.target.checked)}
              />
              <span>Queue-Jobs lokal claimen</span>
            </label>

            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.autoConnect}
                onChange={(event) => updateConfig("autoConnect", event.target.checked)}
              />
              <span>Beim Start automatisch verbinden</span>
            </label>

            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.minimizedStart}
                onChange={(event) => updateConfig("minimizedStart", event.target.checked)}
              />
              <span>Minimiert starten</span>
            </label>

            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.autostartWindows}
                onChange={(event) => updateConfig("autostartWindows", event.target.checked)}
              />
              <span>Autostart bei Windows-Start (folgt)</span>
            </label>

            <label className="connector-field connector-field-full">
              <span>Tray-Modus</span>
              <select
                className="connector-select"
                value={config.trayMode}
                onChange={(event) =>
                  updateConfig("trayMode", event.target.value as ConnectorClientConfig["trayMode"])
                }
              >
                <option value="normal">Normal</option>
                <option value="minimize_to_tray">Beim Minimieren in den Tray</option>
                <option value="start_in_tray">Direkt im Tray starten</option>
              </select>
            </label>
          </div>
        </CardV2>

        <CardV2 title="Sicherheit">
          <ul className="connector-note-list">
            <li>Verbindung nur ausgehend zum UWE Host.</li>
            <li>Connector-Token wird nicht in Logs angezeigt.</li>
            <li>Tokens werden lokal in AppData gespeichert.</li>
            <li>Tray-Integration und Windows-Autostart folgen in späteren Phasen.</li>
          </ul>
        </CardV2>
      </div>
    );
  }

  function renderContent() {
    if (!selectedSection.active) {
      return (
        <SectionPlaceholder
          title={selectedSection.label}
          phase={selectedSection.phase}
          summary={selectedSection.summary}
        />
      );
    }

    switch (selectedSection.id) {
      case "downloads":
        return (
          <DownloadsPanel
            loaded={modelStoreLoaded}
            store={modelStore}
            onLoadStore={loadModelStore}
            onPullModel={runOllamaPull}
          />
        );
      case "library":
        return (
          <ModelLibraryPanel
            loaded={modelStoreLoaded}
            store={modelStore}
            onLoadStore={loadModelStore}
            onSaveStore={persistModelStore}
            onScanModels={runModelScan}
          />
        );
      case "release":
        return (
          <UweReleasePanel
            loaded={modelStoreLoaded}
            store={modelStore}
            onLoadStore={loadModelStore}
            onSaveStore={persistModelStore}
          />
        );
      case "cookbook":
        return (
          <CookbookPanel
            onLoadDashboard={loadCookbookDashboard}
            onPullModel={runOllamaPull}
            onEnableForUwe={enableModelForUwe}
          />
        );
      case "runners":
        return (
          <RunnersPanel
            onProbeRunners={probeRunnersList}
            onStartOllama={runStartOllama}
            onTestRunner={runTestRunner}
          />
        );
      case "security":
        return (
          <SecurityPanel
            privacyMode={config.privacyMode}
            busy={busyAction !== null}
            onChangePrivacyMode={(value) => updateConfig("privacyMode", value)}
            onSave={persistConfig}
          />
        );
      case "jobs":
        return <JobsPanel onLoadJobs={loadConnectorJobs} />;
      case "logs":
        return <LogsPanel onLoadLogs={loadConnectorLogs} />;
      case "connection":
        return renderConnection();
      case "settings":
        return renderSettings();
      case "overview":
      default:
        return renderOverview();
    }
  }

  if (!bootstrapped) {
    return <div className="connector-boot">Lade RTX Connector Client …</div>;
  }

  return (
    <div className="connector-shell">
      {showWizard ? (
        <SetupWizard
          initialConfig={config}
          initialModelStore={modelStore}
          modelStoreLoaded={modelStoreLoaded}
          loadModelStore={loadModelStore}
          saveModelStore={persistModelStore}
          scanModels={runModelScan}
          onCompleted={(saved) => {
            setConfig(saved);
            setShowWizard(false);
            void refreshFromBackend();
            setNotice("Erststart-Wizard abgeschlossen.");
          }}
          onDismiss={() => setShowWizard(false)}
        />
      ) : null}

      <aside className="connector-sidebar">
        <div className="connector-brand">
          <span className="connector-kicker">UWE · Outbound Connector</span>
          <h1>RTX Connector Client</h1>
          <p>Lokale Desktop-App für den RTX Connector auf Windows.</p>
        </div>

        <nav className="connector-nav" aria-label="Hauptnavigation">
          {NAV_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`connector-nav-item${section.id === selectedSectionId ? " is-active" : ""}`}
              onClick={() => setSelectedSectionId(section.id)}
            >
              <span>{section.label}</span>
              <small>{section.active ? section.phase : `Kommt in ${section.phase}`}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="connector-main">
        <header className="connector-header">
          <div>
            <p className="connector-kicker">{selectedSection.phase}</p>
            <h2>{selectedSection.label}</h2>
            <p className="connector-muted">{selectedSection.summary}</p>
          </div>

          <div className="connector-header-actions">
            <HealthBadge
              status={toHealthBadgeStatus(runtimeStatus)}
              label={`${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
            />
            <ButtonV2 variant="ghost" onClick={refreshFromBackend} disabled={busyAction !== null}>
              Neu laden
            </ButtonV2>
          </div>
        </header>

        {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}
        {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

        <section className="connector-content">{renderContent()}</section>
      </main>
    </div>
  );
}
