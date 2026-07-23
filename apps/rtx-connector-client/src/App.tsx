import { useCallback, useEffect, useMemo, useState } from "react";

import { listen } from "@tauri-apps/api/event";

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
import { HealthBadge } from "@uwe/shared-ui";

import { Button } from "./components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./components/ui/card";

import { AudioPanel } from "./components/AudioPanel";
import { CloudflarePanel } from "./components/CloudflarePanel";
import { DeploymentPanel } from "./components/DeploymentPanel";
import { CommandCenterPanel } from "./components/CommandCenterPanel";
import { CookbookPanel } from "./components/CookbookPanel";
import { DownloadsPanel } from "./components/DownloadsPanel";
import { ImagePanel } from "./components/ImagePanel";
import { JobsPanel } from "./components/JobsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { ModelLibraryPanel } from "./components/ModelLibraryPanel";
import { PrintersPanel } from "./components/PrintersPanel";
import { RunnersPanel } from "./components/RunnersPanel";
import { SecurityPanel } from "./components/SecurityPanel";
import { SetupWizard } from "./components/SetupWizard";
import { SpotifyPanel } from "./components/SpotifyPanel";
import { UsersPanel } from "./components/UsersPanel";
import { UweReleasePanel } from "./components/UweReleasePanel";
import { ConnectorShell } from "./components/shell/ConnectorShell";
import { connectorSidebar } from "./navigation/connector-nav";
import {
  humanizeConnectionStatus,
  humanizeProcessStatus,
  toHealthBadgeStatus,
  toMessage,
} from "./lib/connector-runtime-labels";
import {
  cloudflareStart,
  deleteOllamaModel,
  exitApp,
  getConnectorStatus,
  getCookbookDashboard,
  getModelStore,
  getPrinterStore,
  listConnectorJobs,
  listConnectorLogs,
  probeRunners,
  pullOllamaModel,
  readConfig,
  saveModelStore,
  savePrinterStore,
  scanModels,
  scanPrinters,
  startHost,
  spotifyAuthUrl,
  spotifyDevices,
  spotifyDisconnect,
  spotifyExchangeCode,
  spotifySetDevice,
  spotifyTest,
  startConnector,
  startOllama,
  stopConnector,
  testAudio,
  testHostConnection,
  testImage,
  testPrint,
  testRunner,
  writeConfig,
  type ConnectorPrinterStore,
  type ConnectorRuntimeStatus,
  type HostConnectionTestResult,
  type RunnerId,
} from "./lib/tauri";
import { INITIAL_RUNTIME_STATUS, type ConnectorPath } from "./app-runtime";

export default function App() {
  const [activePath, setActivePath] = useState<ConnectorPath>("/");
  const [config, setConfig] = useState<ConnectorClientConfig>(defaultConnectorClientConfig());
  const [modelStore, setModelStore] = useState<ConnectorModelProfileStore>(defaultModelProfileStore());
  const [modelStoreLoaded, setModelStoreLoaded] = useState(false);
  const [printerStore, setPrinterStore] = useState<ConnectorPrinterStore>({ version: 1, printers: [] });
  const [printerStoreLoaded, setPrinterStoreLoaded] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<ConnectorRuntimeStatus>(INITIAL_RUNTIME_STATUS);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HostConnectionTestResult | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [quitting, setQuitting] = useState(false);

  const navGroups = useMemo(() => connectorSidebar(activePath), [activePath]);

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

  const runDeleteModel = useCallback(async (name: string) => {
    const store = await deleteOllamaModel(name);
    setModelStore(store);
    setModelStoreLoaded(true);
    return store;
  }, []);

  const loadPrinterStore = useCallback(async () => {
    const nextStore = await getPrinterStore();
    setPrinterStore(nextStore);
    setPrinterStoreLoaded(true);
    return nextStore;
  }, []);

  const persistPrinterStore = useCallback(async (nextStore: ConnectorPrinterStore) => {
    const saved = await savePrinterStore(nextStore);
    setPrinterStore(saved);
    setPrinterStoreLoaded(true);
    return saved;
  }, []);

  const runPrinterScan = useCallback(async () => {
    const scanned = await scanPrinters();
    setPrinterStore(scanned);
    setPrinterStoreLoaded(true);
    return scanned;
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
      profiles: store.profiles.map((profile: ConnectorModelProfileStore["profiles"][number]) =>
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
      if (!result) return;
      const { nextConfig, nextRuntimeStatus } = result;
      if (nextConfig.autoStartHost) {
        void startHost(nextConfig.localHostRoot || undefined).catch((nextError) => {
          setError(toMessage(nextError));
        });
      }
      if (nextConfig.autoStartTunnel) {
        void cloudflareStart().catch((nextError) => setError(toMessage(nextError)));
      }
      if (
        nextConfig.autoConnect && nextConfig.hostUrl && nextConfig.token &&
        nextRuntimeStatus.status === "stopped"
      ) {
        void startConnector()
          .then(setRuntimeStatus)
          .catch((nextError) => setError(toMessage(nextError)));
      }
    })();
  }, [refreshFromBackend]);

  // The X button (window close) is intercepted in Rust, which emits
  // `app-close-requested` and keeps the window open. We ask the user here and
  // only then fully quit — closing must not silently background the client.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen("app-close-requested", () => setShowQuitConfirm(true)).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!showQuitConfirm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !quitting) setShowQuitConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showQuitConfirm, quitting]);

  async function confirmQuit() {
    setQuitting(true);
    try {
      await exitApp();
    } catch {
      // If the exit call fails the app stays open; let the user try again.
      setQuitting(false);
      setShowQuitConfirm(false);
    }
  }

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
      // start_connector returns Ok with the failure in `status`/`message` — only
      // report success when the process is actually running.
      if (nextRuntimeStatus.status === "running") {
        setNotice("Connector-Core gestartet.");
      } else {
        setError(nextRuntimeStatus.message ?? "Connector konnte nicht gestartet werden.");
      }
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

  function renderHost() {
    const isRunning = runtimeStatus.status === "running";

    return (
      <>
        <div className="connector-grid connector-grid-2">
          <Card>
            <CardHeader>
              <CardTitle>Host und Connector-Token</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
            <CardFooter>
              <div className="connector-actions">
                <Button variant="primary" onClick={persistConfig} disabled={busyAction !== null}>
                  Speichern
                </Button>
                <Button variant="secondary" onClick={runHostTest} disabled={busyAction !== null}>
                  Verbindung testen
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outbound-Laufzeit</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <dt>Token</dt>
                  <dd>{maskToken(config.token) || "Noch nicht gesetzt"}</dd>
                </div>
                <div>
                  <dt>Letzter Heartbeat</dt>
                  <dd>{runtimeStatus.lastHeartbeatAt ?? "Noch keiner"}</dd>
                </div>
              </dl>
            </div>
            </CardContent>
            <CardFooter>
              <div className="connector-actions">
                {isRunning ? (
                  <Button variant="accent" onClick={runStopConnector} disabled={busyAction !== null}>
                    Verbindung stoppen
                  </Button>
                ) : (
                  <Button variant="primary" onClick={runStartConnector} disabled={busyAction !== null}>
                    Verbindung starten
                  </Button>
                )}
                <Button variant="ghost" onClick={refreshFromBackend} disabled={busyAction !== null}>
                  Status aktualisieren
                </Button>
              </div>
            </CardFooter>
          </Card>

          {testResult ? (
            <Card className="connector-grid-span-2">
              <CardHeader>
                <CardTitle>Letzter Verbindungstest</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="connector-stack">
                <HealthBadge
                  status={testResult.ok ? "ok" : "error"}
                  label={testResult.ok ? "Erfolgreich" : "Fehlgeschlagen"}
                />
                <p className="connector-muted">{testResult.message}</p>
                <p className="connector-muted">Geprüft: {testResult.checkedAt}</p>
              </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Client-Optionen</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Transport</span>
              <select
                className="connector-select"
                value={config.transportMode}
                onChange={(event) =>
                  updateConfig(
                    "transportMode",
                    event.target.value as ConnectorClientConfig["transportMode"],
                  )
                }
              >
                <option value="queue">Warteschlange</option>
                <option value="direct">Direktverbindung</option>
                <option value="hybrid">Direkt mit Queue-Fallback</option>
              </select>
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
              <span>Autostart bei Systemstart (Windows &amp; Linux)</span>
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
          </CardContent>
          <CardFooter>
            <div className="connector-actions">
              <Button variant="primary" onClick={persistConfig} disabled={busyAction !== null}>
                Einstellungen speichern
              </Button>
              <Button variant="ghost" onClick={() => setShowWizard(true)} disabled={busyAction !== null}>
                Setup-Wizard erneut öffnen
              </Button>
            </div>
          </CardFooter>
        </Card>
      </>
    );
  }

  function renderModels() {
    return (
      <>
        <CookbookPanel
          onLoadDashboard={loadCookbookDashboard}
          onPullModel={runOllamaPull}
          onEnableForUwe={enableModelForUwe}
        />
        <DownloadsPanel
          loaded={modelStoreLoaded}
          store={modelStore}
          onLoadStore={loadModelStore}
          onPullModel={runOllamaPull}
          onDeleteModel={runDeleteModel}
        />
        <ModelLibraryPanel
          loaded={modelStoreLoaded}
          store={modelStore}
          onLoadStore={loadModelStore}
          onSaveStore={persistModelStore}
          onScanModels={runModelScan}
          onDeleteModel={runDeleteModel}
        />
        <UweReleasePanel
          loaded={modelStoreLoaded}
          store={modelStore}
          onLoadStore={loadModelStore}
          onSaveStore={persistModelStore}
        />
      </>
    );
  }

  function renderDiagnostics() {
    return (
      <>
        <SecurityPanel
          privacyMode={config.privacyMode}
          busy={busyAction !== null}
          onChangePrivacyMode={(value) => updateConfig("privacyMode", value)}
          onSave={persistConfig}
        />
        <SpotifyPanel
          config={config}
          busy={busyAction !== null}
          onChange={updateConfig}
          onSave={persistConfig}
          onAuthUrl={spotifyAuthUrl}
          onExchangeCode={spotifyExchangeCode}
          onLoadDevices={spotifyDevices}
          onSetDevice={spotifySetDevice}
          onTest={spotifyTest}
          onDisconnect={spotifyDisconnect}
        />
        <AudioPanel
          config={config}
          busy={busyAction !== null}
          onChange={updateConfig}
          onSave={persistConfig}
          onTest={testAudio}
        />
        <ImagePanel
          config={config}
          busy={busyAction !== null}
          onChange={updateConfig}
          onSave={persistConfig}
          onTest={testImage}
        />
      </>
    );
  }

  function renderContent() {
    switch (activePath) {
      case "/":
        return (
          <CommandCenterPanel
            config={config}
            connectorStatus={runtimeStatus}
            onConfigSaved={setConfig}
            onStartConnector={runStartConnector}
            onStopConnector={runStopConnector}
            onOpenConnector={() => setActivePath("/connector")}
          />
        );
      case "/connector":
        return renderHost();
      case "/users":
        return <UsersPanel />;
      case "/cloudflare":
        return <CloudflarePanel />;
      case "/deployment":
        return <DeploymentPanel />;
      case "/runner":
        return (
          <RunnersPanel
            onProbeRunners={probeRunnersList}
            onStartOllama={runStartOllama}
            onTestRunner={runTestRunner}
          />
        );
      case "/models": return renderModels();
      case "/printers":
        return (
          <PrintersPanel
            loaded={printerStoreLoaded}
            store={printerStore}
            onLoadStore={loadPrinterStore}
            onSaveStore={persistPrinterStore}
            onScanPrinters={runPrinterScan}
            config={config}
            busy={busyAction !== null}
            onChange={updateConfig}
            onSave={persistConfig}
            onTest={() => testPrint(config.defaultPrinterId)}
          />
        );
      case "/jobs": return <JobsPanel onLoadJobs={loadConnectorJobs} />;
      case "/logs": return <LogsPanel onLoadLogs={loadConnectorLogs} />;
      case "/diagnostics": return renderDiagnostics();
      default: return null;
    }
  }

  const banner = notice || error ? (
    <>
      {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
    </>
  ) : null;

  const headerActions = (
    <>
      <HealthBadge
        status={toHealthBadgeStatus(runtimeStatus)}
        label={`${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
      />
      <Button variant="ghost" onClick={refreshFromBackend} disabled={busyAction !== null}>
        Neu laden
      </Button>
    </>
  );

  const wizardOverlay = showWizard ? (
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
      onDismiss={(saved) => {
        setConfig(saved);
        setShowWizard(false);
      }}
    />
  ) : null;

  const quitOverlay = showQuitConfirm ? (
    <div
      className="connector-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quit-confirm-title"
    >
      <div className="connector-modal">
        <h2 id="quit-confirm-title">Command Center beenden?</h2>
        <p className="connector-muted">
          Die Steuerungs-App wird vollständig geschlossen. Laufende UWE-Dienste (Studio, Portal)
          bleiben im Hintergrund aktiv; die aktive RTX-Verbindung wird beim Beenden getrennt.
        </p>
        <div className="connector-actions connector-modal-actions">
          <Button variant="ghost" onClick={() => setShowQuitConfirm(false)} disabled={quitting} autoFocus>
            Abbrechen
          </Button>
          <Button variant="accent" onClick={confirmQuit} disabled={quitting}>
            {quitting ? "Wird beendet …" : "Beenden"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const overlay = (
    <>
      {wizardOverlay}
      {quitOverlay}
    </>
  );

  return (
    <ConnectorShell
      groups={navGroups}
      brandLabel="UWE Command Center"
      brandKicker="UWE · HOSTING · RTX"
      brandDescription="Die zentrale Anlaufstation für UWE auf diesem Rechner."
      onNavigate={(path) => {
        setActivePath(path as ConnectorPath);
        setNotice(null);
        setError(null);
      }}
      headerActions={headerActions}
      banner={banner}
      overlay={overlay}
      loading={!bootstrapped}
    >
      {renderContent()}
    </ConnectorShell>
  );
}
