import { useCallback, useEffect, useRef, useState } from "react";

import { parseConnectorClientConfig, type ConnectorClientConfig } from "@uwe/connector-client-config";
import { HealthBadge } from "@uwe/shared-ui";

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
import { humanizeConnectionStatus, toHealthBadgeStatus, toMessage } from "../lib/connector-runtime-labels";
import { useHostActionProgress } from "../lib/useHostActionProgress";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { HostBackupsCard, HostLogsCard } from "./command-center/HostMaintenanceCards";
import {
  busyLabel,
  formatBytes,
  formatDuration,
  stateLabel,
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

  const hostOnline = status?.services.every((service) => service.healthy) ?? false;
  // Any service not fully stopped — used to keep "Alles stoppen" enabled even when
  // only some services are up (a partially-running host must still be stoppable).
  const hostAnyRunning = status?.services.some((service) => service.state !== "stopped") ?? false;
  const connectorConfigured = Boolean(config.hostUrl && config.token);
  const installChecks = status ? [
    ["Repository", status.installation.repoReady],
    ["Abhängigkeiten", status.installation.dependenciesReady],
    ["Umgebung", status.installation.envReady],
    ["Datenbank", status.installation.databaseReady],
    ["Produktions-Build", status.installation.buildReady],
  ] as const : [];

  return (
    <div className="command-center-stack">
      <section className={`command-center-hero is-${status?.overall ?? "attention"}`}>
        <div>
          <span className="connector-kicker">ALL-IN-ONE · LOKAL · PRIVATE</span>
          <h3>Ein PC. Ein Command Center.</h3>
          <p>UWE Hosting, Daten und RTX-Leistung laufen gemeinsam auf diesem Rechner - zentral steuerbar, ohne zusätzlichen Host-Dienst.</p>
        </div>
        <div className="command-center-hero-status">
          <HealthBadge status={status?.overall === "ready" ? "ok" : status?.overall === "error" ? "error" : "degraded"} label={stateLabel(status)} />
          <small>{status?.host.hostname ?? "Lokaler Rechner"}</small>
        </div>
      </section>

      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

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

      <div className="command-center-primary-actions">
        <Button variant="primary" onClick={startEverything} disabled={busy !== null || hostOnline}>Alles starten</Button>
        <Button variant="secondary" onClick={stopEverything} disabled={busy !== null || (!hostAnyRunning && connectorStatus.status !== "running")}>Alles stoppen</Button>
        <Button variant="accent" onClick={() => runAction("setup")} disabled={busy !== null}>{status?.installation.buildReady ? "Reparieren / neu bauen" : "UWE einrichten"}</Button>
        {/* Der Assistent ist der Weg, die installierten Bereiche zu ändern —
            „Reparieren" baut bewusst nur den bestehenden Umfang neu. */}
        <Button variant="secondary" onClick={onOpenInstallWizard} disabled={busy !== null}>
          {status?.installation.selectionPersisted ? "Bereiche ändern" : "Ersteinrichtung"}
        </Button>
        <Button
          variant={updateInfo?.updateAvailable ? "primary" : "secondary"}
          onClick={() => (updateInfo?.updateAvailable ? runInstallUpdate() : runCheckUpdate())}
          disabled={busy !== null}
        >
          {busy === "update"
            ? "Update läuft …"
            : busy === "check-update"
              ? "Prüfe …"
              : updateInfo?.updateAvailable
                ? "Update installieren"
                : "Nach Updates suchen"}
        </Button>
        <Button variant="ghost" onClick={() => refresh()} disabled={busy !== null}>Status neu laden</Button>
      </div>

      {updateInfo ? (
        <Card>
          <CardHeader><CardTitle>UWE Releases</CardTitle></CardHeader>
          <CardContent>
            <div className="connector-stack">
              <HealthBadge
                status={updateInfo.updateAvailable ? "degraded" : "ok"}
                label={updateInfo.updateAvailable ? "Update verfügbar" : "Aktuell"}
              />
              <dl className="connector-kv">
                <div><dt>Installiert</dt><dd>{updateInfo.currentVersion ?? "–"} · {updateInfo.currentRevision ?? "–"}</dd></div>
                <div><dt>Neueste</dt><dd>{updateInfo.latestVersion ?? "–"} · {updateInfo.latestTag ?? "–"}</dd></div>
              </dl>
              <p className="connector-muted">
                Update installiert den Release-Stand per Git, baut Studio/Portal neu
                {updateInfo.commandCenterUpdateAvailable
                  ? " und öffnet den Windows-Installer für das Command Center."
                  : "."}
                {updateInfo.dirtyWorktree ? " Lokale Änderungen werden vorher per git stash gesichert." : ""}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <div className="connector-actions">
              <Button variant="ghost" onClick={runCheckUpdate} disabled={busy !== null}>Erneut prüfen</Button>
              <Button variant="primary" onClick={runInstallUpdate} disabled={busy !== null || !updateInfo.updateAvailable}>
                Update installieren
              </Button>
            </div>
          </CardFooter>
        </Card>
      ) : null}

      <div className="connector-grid connector-grid-4">
        {status?.services.map((service) => (
          <Card key={service.id}>
            <CardHeader><CardTitle>{service.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="connector-stack">
                <HealthBadge status={service.healthy ? "ok" : "degraded"} label={service.healthy ? "Online" : service.state === "starting" ? "Startet" : "Gestoppt"} />
                <p className="connector-muted">{service.url}</p>
                <p className="connector-muted">{service.message}</p>
              </div>
            </CardContent>
            <CardFooter>
              <div className="connector-actions">
                <Button variant="ghost" onClick={() => openHostTarget(root || undefined, service.id)} disabled={!service.healthy}>Öffnen</Button>
                {service.state === "stopped" ? (
                  <Button variant="secondary" onClick={() => runServiceAction(service.id, "start")} disabled={busyService !== null || busy !== null}>
                    {busyService === `${service.id}:start` ? "startet …" : "Start"}
                  </Button>
                ) : (
                  <>
                    <Button variant="secondary" onClick={() => runServiceAction(service.id, "restart")} disabled={busyService !== null || busy !== null}>
                      {busyService === `${service.id}:restart` ? "…" : "Neustart"}
                    </Button>
                    <Button variant="ghost" onClick={() => runServiceAction(service.id, "stop")} disabled={busyService !== null || busy !== null}>
                      {busyService === `${service.id}:stop` ? "…" : "Stop"}
                    </Button>
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
        <Card>
          <CardHeader><CardTitle>Maschinenraum</CardTitle></CardHeader>
          <CardContent>
            <div className="connector-stack">
              <HealthBadge status={toHealthBadgeStatus(connectorStatus)} label={humanizeConnectionStatus(connectorStatus.connectionStatus)} />
              <p className="connector-muted">{connectorConfigured ? connectorStatus.message : "Wird bei der lokalen Einrichtung automatisch registriert."}</p>
              {status?.gpu.available ? <strong>{status.gpu.name}</strong> : <span className="connector-muted">Keine NVIDIA-GPU erkannt</span>}
            </div>
          </CardContent>
          <CardFooter><Button variant="ghost" onClick={onOpenConnector}>Maschinenraum einrichten</Button></CardFooter>
        </Card>
        {/* Brain is now a host-managed service (id "brain", :3102) and appears in the
            services grid above like Studio and Portal — no separate hardcoded card. */}
      </div>

      <div className="connector-grid connector-grid-2">
        <Card>
          <CardHeader><CardTitle>Installationszustand</CardTitle></CardHeader>
          <CardContent>
            <ul className="command-center-checklist">
              {installChecks.map(([label, ok]) => <li key={label} className={ok ? "is-ok" : "is-missing"}><span>{ok ? "✓" : "–"}</span><strong>{label}</strong></li>)}
            </ul>
            {status ? (
              <p className="connector-muted">
                Installierte Bereiche: <strong>{status.installation.apps.join(" · ")}</strong>
                {status.installation.selectionPersisted ? "" : " (Vorgabe — Assistent lief noch nicht)"}
              </p>
            ) : null}
            <p className="connector-muted">{status?.installation.message ?? "Status wird ermittelt."}</p>
          </CardContent>
          <CardFooter>
            <div className="connector-actions">
              <Button variant="secondary" onClick={() => runAction("restart")} disabled={busy !== null || !status?.installation.buildReady}>Neu starten</Button>
              <Button variant="ghost" onClick={() => runAction("backup")} disabled={busy !== null || !status?.installation.databaseReady}>Backup erstellen</Button>
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rechner & RTX</CardTitle></CardHeader>
          <CardContent>
            <dl className="connector-kv">
              <div><dt>CPU</dt><dd>{status ? `${status.host.cpuCores} Kerne` : "-"}</dd></div>
              <div><dt>RAM</dt><dd>{status ? `${formatBytes(status.host.ramUsedBytes)} / ${formatBytes(status.host.ramTotalBytes)}` : "-"}</dd></div>
              <div><dt>Datenträger</dt><dd>{status ? `${formatBytes(status.host.diskUsedBytes)} / ${formatBytes(status.host.diskTotalBytes)}` : "-"}</dd></div>
              <div><dt>GPU</dt><dd>{status?.gpu.name ?? "Nicht erkannt"}</dd></div>
              <div><dt>VRAM</dt><dd>{status?.gpu.vramTotalMb ? `${Math.round(status.gpu.vramTotalMb / 1024)} GB` : "-"}</dd></div>
              <div><dt>PC-Uptime</dt><dd>{status ? formatDuration(status.host.uptimeSeconds) : "-"}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lokales Hosting</CardTitle></CardHeader>
        <CardContent>
          <div className="connector-form-grid">
            <label className="connector-field connector-field-full">
              <span>UWE-Projektordner</span>
              <input className="connector-input" value={root} onChange={(event) => setRoot(event.target.value)} placeholder="C:\\git\\UWE" />
              <small>Der aktuelle Checkout bleibt die einzige Codequelle; Daten und Logs liegen separat im lokalen App-Datenordner.</small>
            </label>
            <label className="connector-checkbox">
              <input type="checkbox" checked={autostartApp} onChange={(event) => setAutostartApp(event.target.checked)} />
              <span>Command Center bei Anmeldung starten</span>
            </label>
            <label className="connector-checkbox">
              <input type="checkbox" checked={autoStartHost} onChange={(event) => setAutoStartHost(event.target.checked)} />
              <span>Studio, Portal, Brain und Startseite automatisch starten</span>
            </label>
            <label className="connector-checkbox">
              <input type="checkbox" checked={autoStartTunnel} onChange={(event) => setAutoStartTunnel(event.target.checked)} />
              <span>Cloudflare-Tunnel automatisch starten</span>
            </label>
            <label className="connector-checkbox">
              <input type="checkbox" checked={stopServicesOnExit} onChange={(event) => setStopServicesOnExit(event.target.checked)} />
              <span>Dienste und Tunnel beim Beenden stoppen</span>
            </label>
            <label className="connector-checkbox">
              <input type="checkbox" checked={directAiTransport} onChange={(event) => setDirectAiTransport(event.target.checked)} />
              <span>KI-Jobs direkt zustellen (Hybrid-Transport)</span>
            </label>
          </div>
          <p className="connector-muted">
            Ohne den Haken „Dienste und Tunnel beim Beenden stoppen" laufen Studio, Portal,
            Brain, Familie, Startseite und der Cloudflare-Tunnel als Hintergrundprozesse
            weiter — uweanddragons.org bleibt dann öffentlich erreichbar, obwohl das Command
            Center geschlossen ist.
          </p>
          <p className="connector-muted">
            Direktzustellung schickt KI-Anfragen ohne Warteschlangen-Umweg über die lokale
            Verbindung an den Maschinenraum; die Queue bleibt als Fallback aktiv. Empfohlen,
            wenn UWE und der Maschinenraum auf demselben Rechner laufen. Greift beim nächsten
            Start des Maschinenraums.
          </p>
          {status ? <p className="connector-muted">Stand: {status.branch ?? "detached"} · {status.revision ?? "unbekannt"} · Daten: {status.dataDir}</p> : null}
        </CardContent>
        <CardFooter><Button variant="primary" onClick={saveSettings} disabled={busy !== null}>Einstellungen speichern</Button></CardFooter>
      </Card>

      <HostBackupsCard
        backups={backups}
        disabled={busy !== null}
        canBackup={Boolean(status?.installation.databaseReady)}
        onCreate={() => void runAction("backup").then(() => void loadBackups())}
        onReload={() => void loadBackups()}
        onRestore={(name) => void runRestore(name)}
      />

      <HostLogsCard target={logTarget} lines={logs} onSelect={(next) => void loadLogs(next)} />
    </div>
  );
}
