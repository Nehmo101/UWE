import { useEffect, useMemo, useState } from "react";

import {
  defaultConnectorClientConfig,
  maskToken,
  parseConnectorClientConfig,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";

import { SectionPlaceholder } from "./components/SectionPlaceholder";
import {
  getConnectorStatus,
  readConfig,
  startConnector,
  stopConnector,
  testHostConnection,
  writeConfig,
  type ConnectorRuntimeStatus,
  type HostConnectionTestResult,
} from "./lib/tauri";

type Section = {
  id: string;
  label: string;
  phase: string;
  active: boolean;
  summary: string;
};

const NAV_SECTIONS: Section[] = [
  {
    id: "overview",
    label: "Overview",
    phase: "P0",
    active: true,
    summary: "Lokaler Status, Schnellzugriffe und Rollout-Ueberblick.",
  },
  {
    id: "connection",
    label: "Connection",
    phase: "P0",
    active: true,
    summary: "UWE Host URL, Connector-Token und Verbindungstest.",
  },
  {
    id: "settings",
    label: "Settings",
    phase: "P0",
    active: true,
    summary: "Queue-Verhalten, Tray-Modus und Windows-Startoptionen.",
  },
  {
    id: "models",
    label: "Models",
    phase: "Phase 1",
    active: false,
    summary: "Lokale Ollama-, LM Studio- und llama.cpp-Modelle verwalten.",
  },
  {
    id: "capabilities",
    label: "Capabilities",
    phase: "Phase 1",
    active: false,
    summary: "Erkannte Connector-Faehigkeiten und Host-Allowlist sichtbar machen.",
  },
  {
    id: "queue",
    label: "Queue",
    phase: "Phase 1",
    active: false,
    summary: "Claim-Politik, Lane-Prioritaeten und Backpressure steuern.",
  },
  {
    id: "jobs",
    label: "Jobs",
    phase: "Phase 1",
    active: false,
    summary: "Aktive und letzte RTX-Jobs inklusive Ergebnisstatus ansehen.",
  },
  {
    id: "audio",
    label: "Audio",
    phase: "Phase 1",
    active: false,
    summary: "Lokale Audioausgabe und Soundboard-Worker sichtbar konfigurieren.",
  },
  {
    id: "image-worker",
    label: "Image Worker",
    phase: "Phase 2",
    active: false,
    summary: "Bild-Backends, Worker-Binaerpfade und Ausfuehrungsprofile pflegen.",
  },
  {
    id: "logs",
    label: "Logs",
    phase: "Phase 1",
    active: false,
    summary: "Redigierte Connector-Logs mit Download und Filteransicht.",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    phase: "Phase 1",
    active: false,
    summary: "Host-Checks, Provider-Reachability und Health-Diagnosen anzeigen.",
  },
  {
    id: "updates",
    label: "Updates",
    phase: "Phase 2",
    active: false,
    summary: "Desktop-Updater, Versionshinweise und Rollback-Hinweise.",
  },
  {
    id: "security",
    label: "Security",
    phase: "Phase 2",
    active: false,
    summary: "Token-Rotation, Log-Redaction und lokale Privacy-Guardrails.",
  },
  {
    id: "about",
    label: "About",
    phase: "Phase 2",
    active: false,
    summary: "Build-Info, Runtime-Versionen und Support-Hinweise.",
  },
];

const INITIAL_RUNTIME_STATUS: ConnectorRuntimeStatus = {
  status: "stopped",
  message: "Connector-Stub ist noch nicht gestartet.",
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
      return "Verbinde";
    case "ready":
      return "Bereit";
    case "degraded":
      return "Eingeschraenkt";
    case "disconnected":
      return "Getrennt";
    case "error":
      return "Fehler";
    case "not_configured":
      return "Nicht konfiguriert";
    default:
      return status;
  }
}

function humanizeProcessStatus(status: ConnectorRuntimeStatus["status"]): string {
  switch (status) {
    case "running":
      return "Laeuft";
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
  const [runtimeStatus, setRuntimeStatus] = useState<ConnectorRuntimeStatus>(INITIAL_RUNTIME_STATUS);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HostConnectionTestResult | null>(null);

  const selectedSection = useMemo(
    () => NAV_SECTIONS.find((section) => section.id === selectedSectionId) ?? NAV_SECTIONS[0],
    [selectedSectionId],
  );

  useEffect(() => {
    void refreshFromBackend();
  }, []);

  async function refreshFromBackend() {
    setBusyAction("refresh");
    setError(null);

    try {
      const [nextConfig, nextRuntimeStatus] = await Promise.all([readConfig(), getConnectorStatus()]);
      setConfig(nextConfig);
      setRuntimeStatus(nextRuntimeStatus);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
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
      const normalizedConfig = parseConnectorClientConfig({
        ...config,
        wizardCompleted:
          config.wizardCompleted || Boolean(config.hostUrl.trim() && config.token.trim()),
      });
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
      const result = await testHostConnection(config.hostUrl);
      setTestResult(result);
      setNotice(result.ok ? "Host-Test erfolgreich abgeschlossen." : null);
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
      const nextRuntimeStatus = await startConnector();
      setRuntimeStatus(nextRuntimeStatus);
      setNotice("Connector-Stub als laufend markiert.");
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
      setNotice("Connector-Stub gestoppt.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }

  function renderOverview() {
    const activeCount = NAV_SECTIONS.filter((section) => section.active).length;
    const backlogCount = NAV_SECTIONS.length - activeCount;

    return (
      <>
        <div className="connector-grid connector-grid-3">
          <CardV2 title="Connector-Status">
            <div className="connector-stack">
              <HealthBadge
                status={toHealthBadgeStatus(runtimeStatus)}
                label={`${humanizeConnectionStatus(runtimeStatus.connectionStatus)} / ${humanizeProcessStatus(runtimeStatus.status)}`}
              />
              <p className="connector-muted">{runtimeStatus.message}</p>
              <dl className="connector-kv">
                <div>
                  <dt>Letzter Heartbeat</dt>
                  <dd>{runtimeStatus.lastHeartbeatAt ?? "Noch keiner"}</dd>
                </div>
              </dl>
            </div>
          </CardV2>

          <CardV2 title="Aktive P0-Module">
            <div className="connector-stack">
              <p className="connector-stat">{activeCount} / {NAV_SECTIONS.length}</p>
              <p className="connector-muted">
                Overview, Connection und Settings sind im Scaffold direkt nutzbar.
              </p>
            </div>
          </CardV2>

          <CardV2 title="Backlog">
            <div className="connector-stack">
              <p className="connector-stat">{backlogCount} weitere Bereiche</p>
              <p className="connector-muted">
                Alle weiteren Desktop-Ansichten sind als Phasen-Platzhalter vorbereitet.
              </p>
            </div>
          </CardV2>
        </div>

        <div className="connector-grid connector-grid-2">
          <CardV2
            title="Lokales Profil"
            footer={
              <div className="connector-actions">
                <ButtonV2 variant="secondary" onClick={() => setSelectedSectionId("connection")}>
                  Connection oeffnen
                </ButtonV2>
                <ButtonV2 variant="ghost" onClick={() => setSelectedSectionId("settings")}>
                  Settings oeffnen
                </ButtonV2>
              </div>
            }
          >
            <dl className="connector-kv">
              <div>
                <dt>Name</dt>
                <dd>{config.name}</dd>
              </div>
              <div>
                <dt>Host</dt>
                <dd>{config.hostUrl || "Noch nicht gesetzt"}</dd>
              </div>
              <div>
                <dt>Token</dt>
                <dd>{maskToken(config.token) || "Noch nicht gesetzt"}</dd>
              </div>
              <div>
                <dt>Queue</dt>
                <dd>{config.queueEnabled ? "Aktiv" : "Deaktiviert"}</dd>
              </div>
            </dl>
          </CardV2>

          <CardV2 title="Naechste Phasen">
            <ul className="connector-phase-list">
              {NAV_SECTIONS.filter((section) => !section.active).map((section) => (
                <li key={section.id}>
                  <strong>{section.label}</strong>
                  <span>{section.phase}</span>
                </li>
              ))}
            </ul>
          </CardV2>
        </div>
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
                placeholder="RTX Host Connector"
              />
            </label>

            <label className="connector-field">
              <span>UWE Host URL</span>
              <input
                className="connector-input"
                value={config.hostUrl}
                onChange={(event) => updateConfig("hostUrl", event.target.value)}
                placeholder="https://uwe.local"
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
              P0 startet noch keinen echten Node-Connectorprozess, sondern schaltet nur
              den lokalen Stub-Zustand fuer die Tauri-Oberflaeche.
            </p>
          </div>
        </CardV2>

        {testResult ? (
          <CardV2 title="Letzter Verbindungstest" className="connector-grid-span-2">
            <div className="connector-stack">
              <HealthBadge
                status={testResult.ok ? "ok" : "error"}
                label={`${testResult.ok ? "Erfolgreich" : "Fehlgeschlagen"} / ${humanizeConnectionStatus(testResult.status)}`}
              />
              <p className="connector-muted">{testResult.message}</p>
              <p className="connector-muted">Geprueft: {testResult.checkedAt}</p>
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
          title="Lokale Client-Optionen"
          footer={
            <div className="connector-actions">
              <ButtonV2 variant="primary" onClick={persistConfig} disabled={busyAction !== null}>
                Settings speichern
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
              <span>Fenster minimiert starten</span>
            </label>

            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={config.autostartWindows}
                onChange={(event) => updateConfig("autostartWindows", event.target.checked)}
              />
              <span>Windows-Autostart vormerken</span>
            </label>

            <label className="connector-field connector-field-full">
              <span>Tray-Modus</span>
              <select
                className="connector-select"
                value={config.trayMode}
                onChange={(event) => updateConfig("trayMode", event.target.value as ConnectorClientConfig["trayMode"])}
              >
                <option value="normal">Normal</option>
                <option value="minimize_to_tray">Beim Minimieren in den Tray</option>
                <option value="start_in_tray">Direkt im Tray starten</option>
              </select>
            </label>
          </div>
        </CardV2>

        <CardV2 title="P0-Hinweise">
          <ul className="connector-note-list">
            <li>Autostart ist im Scaffold nur als Konfigurationswert vorhanden.</li>
            <li>Tray-Integration, native Notifications und echte Updater folgen spaeter.</li>
            <li>Persistenz liegt bereits in einem JSON im lokalen AppData-Verzeichnis.</li>
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
      case "connection":
        return renderConnection();
      case "settings":
        return renderSettings();
      case "overview":
      default:
        return renderOverview();
    }
  }

  return (
    <div className="connector-shell">
      <aside className="connector-sidebar">
        <div className="connector-brand">
          <span className="connector-kicker">Windows-first Tauri client</span>
          <h1>UWE RTX Connector Client</h1>
          <p>Desktop-Startpunkt fuer den outbound RTX Connector auf dem lokalen Rechner.</p>
        </div>

        <nav className="connector-nav" aria-label="Connector navigation">
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
            <p className="connector-kicker">P0 scaffold</p>
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
