import { maskToken, type ConnectorClientConfig } from "@uwe/connector-client-config";
import { HealthBadge } from "@uwe/shared-ui";

import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import {
  humanizeConnectionStatus,
  humanizeProcessStatus,
  toHealthBadgeStatus,
} from "../lib/connector-runtime-labels";
import type { ConnectorRuntimeStatus, HostConnectionTestResult } from "../lib/tauri";

/**
 * Host-/Connector-Konfigurationsseite (Route /connector) — aus App.tsx
 * extrahiert (Datei-Budget); Zustand und Aktionen bleiben in App.
 */
export function HostPanel({
  config,
  runtimeStatus,
  testResult,
  busyAction,
  updateConfig,
  persistConfig,
  runHostTest,
  runStartConnector,
  runStopConnector,
  refreshFromBackend,
  onOpenWizard,
}: {
  config: ConnectorClientConfig;
  runtimeStatus: ConnectorRuntimeStatus;
  testResult: HostConnectionTestResult | null;
  busyAction: string | null;
  updateConfig: <K extends keyof ConnectorClientConfig>(
    key: K,
    value: ConnectorClientConfig[K],
  ) => void;
  persistConfig: () => void;
  runHostTest: () => void;
  runStartConnector: () => void;
  runStopConnector: () => void;
  refreshFromBackend: () => void;
  onOpenWizard: () => void;
}) {
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
            <Button variant="ghost" onClick={onOpenWizard} disabled={busyAction !== null}>
              Setup-Wizard erneut öffnen
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
