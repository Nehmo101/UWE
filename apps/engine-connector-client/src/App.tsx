import { useCallback, useEffect, useMemo, useState } from "react";

import { listen } from "@tauri-apps/api/event";

import {
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
import {
  defaultModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import { HealthBadge } from "@uwe/shared-ui";

import { Button } from "./components/ui/button";

import { AudioPanel } from "./components/AudioPanel";
import { CloudflarePanel } from "./components/CloudflarePanel";
import { DeploymentPanel } from "./components/DeploymentPanel";
import { CommandCenterPanel } from "./components/CommandCenterPanel";
import { CookbookPanel } from "./components/CookbookPanel";
import { DownloadsPanel } from "./components/DownloadsPanel";
import { HostPanel } from "./components/HostPanel";
import { ImagePanel } from "./components/ImagePanel";
import { SpeechPanel } from "./components/SpeechPanel";
import { ImportPanel } from "./components/ImportPanel";
import { JobsPanel } from "./components/JobsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { DocumentOcrPanel } from "./components/DocumentOcrPanel";
import { ModelLibraryPanel } from "./components/ModelLibraryPanel";
import { PrintersPanel } from "./components/PrintersPanel";
import { RunnersPanel } from "./components/RunnersPanel";
import { SecurityPanel } from "./components/SecurityPanel";
import { SetupWizard } from "./components/SetupWizard";
import { InstallWizard } from "./components/install/InstallWizard";
import { SpotifyPanel } from "./components/SpotifyPanel";
import { OpsPanel } from "./components/OpsPanel";
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
  getHostStatus,
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
  const [showInstallWizard, setShowInstallWizard] = useState(false);
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

  /**
   * Ersteinrichtung beim Start aufspringen lassen, solange auf diesem Rechner
   * keine benutzbare Installation liegt und der Nutzer den Assistenten nicht
   * bereits durchlaufen oder auf „Später" gesetzt hat.
   *
   * Bewusst an `buildReady`/`databaseReady` festgemacht statt an „Auswahl schon
   * geschrieben": bricht die Einrichtung nach dem Schreiben der Auswahl ab, muss
   * der Assistent beim nächsten Start wieder da sein — sonst bleibt der Rechner
   * halb eingerichtet zurück. Fertige Bestandsinstallationen ohne Auswahl-Datei
   * erfüllen beide Flags und werden dadurch nie behelligt.
   */
  const maybeOpenInstallWizard = useCallback(async (nextConfig: ConnectorClientConfig) => {
    if (nextConfig.installWizardCompleted) return;
    try {
      const status = await getHostStatus(nextConfig.localHostRoot || undefined);
      if (status.installation.buildReady && status.installation.databaseReady) return;
      setShowInstallWizard(true);
    } catch {
      // Kein lesbarer Projektordner: dann ist das Command Center nicht der
      // Installer dieses Rechners — Overlay bleibt zu.
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await refreshFromBackend();
      setBootstrapped(true);
      if (!result) return;
      const { nextConfig, nextRuntimeStatus } = result;
      void maybeOpenInstallWizard(nextConfig);
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
  }, [maybeOpenInstallWizard, refreshFromBackend]);

  // The X button (window close) is intercepted in Rust, which emits
  // `app-close-requested` and keeps the window open. We ask the user here and
  // only then fully quit — closing must not silently background the client.
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

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
    return (
      <HostPanel
        config={config}
        runtimeStatus={runtimeStatus}
        testResult={testResult}
        busyAction={busyAction}
        updateConfig={updateConfig}
        persistConfig={persistConfig}
        runHostTest={runHostTest}
        runStartConnector={runStartConnector}
        runStopConnector={runStopConnector}
        refreshFromBackend={refreshFromBackend}
        onOpenWizard={() => setShowWizard(true)}
      />
    );
  }

  function renderModels() {
    return (
      <>
        {/* Steht bewusst vorn: ohne dieses Modell fallen PDF-Import und
            Scan-Inbox auf den reinen Textlayer zurück. */}
        <DocumentOcrPanel
          store={modelStore}
          onPullModel={runOllamaPull}
          onEnableForUwe={enableModelForUwe}
        />
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
        <SpeechPanel
          config={config}
          busy={busyAction !== null}
          onChange={updateConfig}
          onSave={persistConfig}
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
            onOpenInstallWizard={() => setShowInstallWizard(true)}
          />
        );
      case "/connector":
        return renderHost();
      case "/users":
        return <UsersPanel />;
      case "/ops":
        return <OpsPanel />;
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
      case "/import": return <ImportPanel />;
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
        label={`Maschinenraum: ${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
      />
      <Button variant="ghost" onClick={refreshFromBackend} disabled={busyAction !== null}>
        Neu laden
      </Button>
    </>
  );

  const installWizardOverlay = showInstallWizard ? (
    <InstallWizard
      config={config}
      onConfigSaved={setConfig}
      onCompleted={() => {
        setShowInstallWizard(false);
        void refreshFromBackend();
        setNotice("Ersteinrichtung abgeschlossen.");
      }}
      onDismiss={() => setShowInstallWizard(false)}
    />
  ) : null;

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
          {config.stopServicesOnExit
            ? "Die Steuerungs-App wird vollständig geschlossen. Studio, Portal, Brain, Familie und Startseite werden gestoppt, der Cloudflare-Tunnel wird getrennt — uweanddragons.org ist danach nicht mehr erreichbar. Auch der laufende Maschinenraum wird getrennt."
            : "Die Steuerungs-App wird vollständig geschlossen. Laufende UWE-Dienste (Studio, Portal) bleiben im Hintergrund aktiv und uweanddragons.org bleibt erreichbar; der laufende Maschinenraum wird beim Beenden getrennt."}
        </p>
        <div className="connector-actions connector-modal-actions">
          <Button variant="ghost" onClick={() => setShowQuitConfirm(false)} disabled={quitting} autoFocus>
            Abbrechen
          </Button>
          <Button variant="accent" onClick={confirmQuit} disabled={quitting}>
            {quitting
              ? config.stopServicesOnExit
                ? "Dienste werden gestoppt …"
                : "Wird beendet …"
              : "Beenden"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // Ersteinrichtung zuerst: solange sie offen ist, hat kein anderes Overlay
  // etwas zu melden — auf diesem Rechner existiert noch keine Installation.
  const overlay = (
    <>
      {installWizardOverlay}
      {installWizardOverlay ? null : wizardOverlay}
      {quitOverlay}
    </>
  );

  return (
    <ConnectorShell
      groups={navGroups}
      brandLabel="UWE Command Center"
      brandKicker="UWE · HOSTING · Maschinenraum"
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
