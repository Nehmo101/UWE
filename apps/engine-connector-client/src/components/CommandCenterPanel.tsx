import { useCallback, useEffect, useRef, useState } from "react";

import { parseConnectorClientConfig, type ConnectorClientConfig } from "@uwe/connector-client-config";

import {
  backupHost,
  checkHostUpdate,
  cloudflareStop,
  getHostLogs,
  getHostStatus,
  listBackups,
  openHostTarget,
  restoreBackup,
  readConfig,
  restartHost,
  restartService,
  setupHost,
  startHost,
  startService,
  stopHost,
  stopService,
  updateHost,
  writeConfig,
  type ConnectorRuntimeStatus,
  type LocalHostActionResult,
  type LocalHostLogsResult,
  type LocalHostServiceId,
  type LocalHostStatus,
  type LocalHostUpdateInfo,
  type HostBackupEntry,
} from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { useHostActionProgress } from "../lib/useHostActionProgress";
import { CommandCenterMaintenance } from "./command-center/CommandCenterMaintenance";
import { CommandCenterOverview } from "./command-center/CommandCenterOverview";
import {
  busyLabel,
  type BusyState,
  type HostAction,
} from "./command-center/host-format";

interface CommandCenterPanelProps {
  config: ConnectorClientConfig;
  connectorStatus: ConnectorRuntimeStatus;
  onConfigSaved: (config: ConnectorClientConfig) => void;
  onStartConnector: () => Promise<void>;
  onStopConnector: () => Promise<void>;
  onOpenConnector: () => void;
  /** Ersteinrichtungs-Assistent erneut öffnen (App-Auswahl ändern). */
  onOpenInstallWizard: () => void;
}

const ACTIONS: Record<HostAction, (root?: string) => Promise<LocalHostActionResult>> = {
  setup: setupHost,
  start: startHost,
  stop: stopHost,
  restart: restartHost,
  backup: backupHost,
};

export function CommandCenterPanel({
  config,
  connectorStatus,
  onConfigSaved,
  onStartConnector,
  onStopConnector,
  onOpenConnector,
  onOpenInstallWizard,
}: CommandCenterPanelProps) {
  const [status, setStatus] = useState<LocalHostStatus | null>(null);
  const [root, setRoot] = useState(config.localHostRoot);
  const [autoStartHost, setAutoStartHost] = useState(config.autoStartHost);
  const [autoStartTunnel, setAutoStartTunnel] = useState(config.autoStartTunnel);
  const [stopServicesOnExit, setStopServicesOnExit] = useState(config.stopServicesOnExit);
  const [autostartApp, setAutostartApp] = useState(config.autostartWindows);
  // "Direktzustellung" bündelt direct + hybrid: der Haken steht für "KI-Jobs ohne
  // Queue-Umweg", die Speicherlogik erhält eine explizite "direct"-Wahl aus dem
  // Verbindungs-Panel und setzt sonst hybrid (Direct mit Queue-Fallback).
  const [directAiTransport, setDirectAiTransport] = useState(config.transportMode !== "queue");
  const [busy, setBusy] = useState<BusyState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<LocalHostLogsResult["target"]>("command-center");
  const [logs, setLogs] = useState<string[]>([]);
  const [updateInfo, setUpdateInfo] = useState<LocalHostUpdateInfo | null>(null);
  // "<serviceId>:<action>" while a single-service start/stop/restart runs.
  const [busyService, setBusyService] = useState<string | null>(null);
  const [backups, setBackups] = useState<HostBackupEntry[]>([]);

  // Live determinate progress for the long actions (setup/update), streamed from
  // the host CLI. Quick actions emit no events → the bar falls back to an
  // indeterminate animation driven purely by `busy`.
  const { progress: hostProgress, reset: resetHostProgress } = useHostActionProgress();

  // Latest typed project root, read inside the stable `refresh` callback so that
  // typing in the folder input does not recreate `refresh` (which would otherwise
  // re-fire the status probe — a node-process spawn — on every keystroke).
  const rootRef = useRef(root);
  useEffect(() => {
    rootRef.current = root;
  }, [root]);
  // Monotonic request id so a slower, older probe cannot overwrite a newer result.
  const requestSeqRef = useRef(0);

  const refresh = useCallback(
    async (
      requestedRoot?: string,
      options?: { background?: boolean },
    ): Promise<LocalHostStatus | null> => {
      const targetRoot = requestedRoot ?? rootRef.current;
      const background = options?.background ?? false;
      const seq = (requestSeqRef.current += 1);
      if (!background) setBusy((current) => current ?? "refresh");
      setError(null);
      try {
        const next = await getHostStatus(targetRoot || undefined);
        if (seq !== requestSeqRef.current) return next; // stale response — drop it
        setStatus(next);
        if (!targetRoot) setRoot(next.root);
        return next;
      } catch (nextError) {
        if (seq === requestSeqRef.current) {
          setError(toMessage(nextError));
        }
        return null;
      } finally {
        if (!background) setBusy((current) => (current === "refresh" ? null : current));
      }
    },
    [],
  );

  useEffect(() => {
    void refresh(config.localHostRoot);
  }, [config.localHostRoot, refresh]);

  // Nach Einrichtung/Speichern liefert der Parent eine frisch gelesene Config —
  // der Haken folgt dann dem persistierten Transport statt einem alten Entwurf.
  useEffect(() => {
    setDirectAiTransport(config.transportMode !== "queue");
  }, [config.transportMode]);

  useEffect(() => {
    // While a user-initiated action is running, skip the poll. Otherwise poll in
    // the background: it must NOT set `busy`, so the action buttons stay enabled.
    if (busy) return;
    const timer = window.setInterval(() => void refresh(undefined, { background: true }), 15_000);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  async function saveSettings() {
    setBusy("settings");
    resetHostProgress();
    setError(null);
    setMessage(null);
    try {
      const next = parseConnectorClientConfig({
        ...config,
        localHostRoot: root,
        autoStartHost,
        autoStartTunnel,
        stopServicesOnExit,
        autostartWindows: autostartApp,
        transportMode: directAiTransport
          ? config.transportMode === "direct"
            ? "direct"
            : "hybrid"
          : "queue",
        hostUrl: config.hostUrl || status?.services.find((service) => service.id === "studio")?.url || "http://127.0.0.1:3000",
      });
      const saved = await writeConfig(next);
      const transportChanged = saved.transportMode !== config.transportMode;
      onConfigSaved(saved);
      setMessage(
        transportChanged && connectorStatus.status === "running"
          ? "Command-Center-Einstellungen gespeichert. Der neue KI-Transport greift nach einem Neustart des Maschinenraums."
          : "Command-Center-Einstellungen gespeichert.",
      );
      await refresh(saved.localHostRoot);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action: HostAction): Promise<LocalHostActionResult | null> {
    if (
      action === "setup" &&
      !window.confirm("UWE neu einrichten / bauen? Das baut Studio, Portal, Brain und die Startseite neu und dauert einige Minuten.")
    ) {
      return null;
    }
    setBusy(action);
    resetHostProgress();
    setMessage(action === "setup" ? "UWE wird eingerichtet. Build und Migration können einige Minuten dauern." : null);
    setError(null);
    try {
      const result = await ACTIONS[action](root || undefined);
      setStatus(result.status);
      if (result.ok) {
        if (action === "setup") onConfigSaved(await readConfig());
        setMessage(result.message);
      } else {
        setError(result.message);
      }
      return result;
    } catch (nextError) {
      setError(toMessage(nextError));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function startEverything() {
    setBusy("all");
    resetHostProgress();
    setError(null);
    setMessage("UWE wird gestartet.");
    try {
      const result = await startHost(root || undefined);
      setStatus(result.status);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (config.hostUrl && config.token) await onStartConnector();
      setMessage(config.hostUrl && config.token ? "UWE und Maschinenraum laufen." : "UWE läuft. Für den Maschinenraum fehlt noch der Token.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function stopEverything() {
    setBusy("all");
    resetHostProgress();
    setError(null);
    try {
      if (connectorStatus.status === "running") await onStopConnector();
      // Erst den Tunnel, dann die Dienste: sonst zeigt uweanddragons.org für die
      // Dauer des Stopps 502 statt schlicht offline zu sein. „Alles" schließt den
      // Tunnel ein — ein laufender Tunnel ohne Dienste ist kein gestopptes UWE.
      await cloudflareStop();
      const result = await stopHost(root || undefined);
      setStatus(result.status);
      setMessage("UWE, Tunnel und Maschinenraum wurden gestoppt.");
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function runServiceAction(
    serviceId: LocalHostServiceId,
    action: "start" | "stop" | "restart",
  ) {
    setBusyService(`${serviceId}:${action}`);
    setError(null);
    setMessage(null);
    try {
      const fn = action === "start" ? startService : action === "stop" ? stopService : restartService;
      const result = await fn(serviceId, root || undefined);
      setStatus(result.status);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusyService(null);
    }
  }

  const loadBackups = useCallback(async () => {
    try {
      const result = await listBackups(rootRef.current || undefined);
      setBackups(result.backups);
    } catch {
      // non-fatal — the backups card just stays empty
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function runRestore(name: string) {
    if (!window.confirm(`Backup „${name}" wiederherstellen? Die aktuellen Daten werden dabei überschrieben.`)) return;
    setBusy("all");
    setError(null);
    setMessage(null);
    try {
      const result = await restoreBackup(name, root || undefined);
      setStatus(result.status);
      if (result.ok) {
        setMessage(result.message);
        await loadBackups();
      } else {
        setError(result.message);
      }
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(null);
    }
  }

  async function loadLogs(target = logTarget) {
    setLogTarget(target);
    try {
      const result = await getHostLogs(root || undefined, target);
      setLogs(result.lines);
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }

  async function runCheckUpdate() {
    setBusy("check-update");
    resetHostProgress();
    setError(null);
    setMessage("Suche nach UWE-Releases …");
    try {
      const result = await checkHostUpdate(root || undefined);
      setUpdateInfo(result);
      setStatus(result.status);
      if (!result.ok) {
        setError(result.message);
        setMessage(null);
        return;
      }
      setMessage(result.message);
    } catch (nextError) {
      setError(toMessage(nextError));
      setMessage(null);
    } finally {
      setBusy(null);
    }
  }

  async function runInstallUpdate() {
    if (
      !window.confirm("Update installieren? Der Code wird auf origin/main synchronisiert, alle Apps werden neu gebaut und die Dienste neu gestartet — das dauert mehrere Minuten.")
    ) {
      return;
    }
    setBusy("update");
    resetHostProgress();
    setError(null);
    setMessage("Update wird installiert: Code synchronisieren, Abhängigkeiten, Migration und Build. Das kann mehrere Minuten dauern.");
    try {
      const result = await updateHost(root || undefined);
      setStatus(result.status);
      if (result.ok) {
        setMessage(result.message);
        const refreshed = await checkHostUpdate(root || undefined);
        setUpdateInfo(refreshed);
      } else {
        setError(result.message);
        setMessage(null);
      }
    } catch (nextError) {
      setError(toMessage(nextError));
      setMessage(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="command-center-stack">
      {message ? (
        <div className="connector-banner connector-banner-success command-center-notice" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Hinweis schließen">×</button>
        </div>
      ) : null}
      {error ? (
        <div className="connector-banner connector-banner-error command-center-notice" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fehlermeldung schließen">×</button>
        </div>
      ) : null}

      {busy ? (() => {
        const determinate =
          hostProgress != null &&
          hostProgress.total > 0 &&
          (busy === "setup" || busy === "update");
        const percent = determinate
          ? Math.min(100, Math.round((hostProgress!.step / hostProgress!.total) * 100))
          : null;
        return (
          <div className="command-center-progress" role="status" aria-live="polite">
            <div className="command-center-progress-head">
              <span className="command-center-progress-title">{busyLabel(busy, status)}</span>
              {determinate ? (
                <span className="command-center-progress-count">
                  Schritt {hostProgress!.step} von {hostProgress!.total} · {percent}%
                </span>
              ) : (
                <span className="command-center-progress-count">Bitte warten …</span>
              )}
            </div>
            <div
              className={`command-center-progress-track${determinate ? "" : " is-indeterminate"}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={determinate ? percent! : undefined}
            >
              <div
                className="command-center-progress-fill"
                style={determinate ? { width: `${percent}%` } : undefined}
              />
            </div>
            {determinate ? (
              <small className="command-center-progress-phase">{hostProgress!.label}</small>
            ) : null}
          </div>
        );
      })() : null}

      <CommandCenterOverview
        status={status}
        connectorStatus={connectorStatus}
        updateInfo={updateInfo}
        busy={busy}
        busyService={busyService}
        onSetup={() => void runAction("setup")}
        onStartAll={() => void startEverything()}
        onStopAll={() => void stopEverything()}
        onRefresh={() => void refresh()}
        onOpenService={(serviceId) => void openHostTarget(root || undefined, serviceId)}
        onServiceAction={(serviceId, action) => void runServiceAction(serviceId, action)}
        onOpenConnector={onOpenConnector}
        onOpenInstallWizard={onOpenInstallWizard}
        onCheckUpdate={() => void runCheckUpdate()}
      />

      <CommandCenterMaintenance
        status={status}
        updateInfo={updateInfo}
        busy={busy}
        root={root}
        autoStartHost={autoStartHost}
        autoStartTunnel={autoStartTunnel}
        stopServicesOnExit={stopServicesOnExit}
        autostartApp={autostartApp}
        directAiTransport={directAiTransport}
        backups={backups}
        logTarget={logTarget}
        logs={logs}
        onRootChange={setRoot}
        onAutoStartHostChange={setAutoStartHost}
        onAutoStartTunnelChange={setAutoStartTunnel}
        onStopServicesOnExitChange={setStopServicesOnExit}
        onAutostartAppChange={setAutostartApp}
        onDirectAiTransportChange={setDirectAiTransport}
        onSaveSettings={() => void saveSettings()}
        onSetup={() => void runAction("setup")}
        onOpenInstallWizard={onOpenInstallWizard}
        onCheckUpdate={() => void runCheckUpdate()}
        onInstallUpdate={() => void runInstallUpdate()}
        onRestart={() => void runAction("restart")}
        onCreateBackup={() => void runAction("backup").then(() => void loadBackups())}
        onReloadBackups={() => void loadBackups()}
        onRestoreBackup={(name) => void runRestore(name)}
        onSelectLog={(target) => void loadLogs(target)}
      />
    </div>
  );
}
