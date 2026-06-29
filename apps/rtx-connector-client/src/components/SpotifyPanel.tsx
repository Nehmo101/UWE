import { useState } from "react";

import { ButtonV2, CardV2, HealthBadge } from "@uwe/shared-ui";
import type { ConnectorClientConfig } from "@uwe/connector-client-config";

import type {
  SpotifyAuthUrlResult,
  SpotifyDevicesResult,
  SpotifyStatusResult,
} from "../lib/tauri";

type Props = {
  config: ConnectorClientConfig;
  busy: boolean;
  onChange: <K extends keyof ConnectorClientConfig>(key: K, value: ConnectorClientConfig[K]) => void;
  onSave: () => Promise<void>;
  onAuthUrl: () => Promise<SpotifyAuthUrlResult>;
  onExchangeCode: (code: string) => Promise<SpotifyStatusResult>;
  onLoadDevices: () => Promise<SpotifyDevicesResult>;
  onSetDevice: (deviceId: string | null) => Promise<SpotifyStatusResult>;
  onTest: (action: "play" | "pause") => Promise<SpotifyStatusResult>;
  onDisconnect: () => Promise<SpotifyStatusResult>;
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

export function SpotifyPanel({
  config,
  busy,
  onChange,
  onSave,
  onAuthUrl,
  onExchangeCode,
  onLoadDevices,
  onSetDevice,
  onTest,
  onDisconnect,
}: Props) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devicesResult, setDevicesResult] = useState<SpotifyDevicesResult | null>(null);

  const disabled = busy || activeAction !== null;
  const connected = devicesResult?.connected ?? false;

  async function run(action: string, fn: () => Promise<void>) {
    setActiveAction(action);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSave() {
    await run("save", async () => {
      await onSave();
      setNotice("Spotify-Zugangsdaten gespeichert.");
    });
  }

  async function handleAuthUrl() {
    await run("auth", async () => {
      const result = await onAuthUrl();
      setAuthUrl(result.url);
      if (typeof window !== "undefined") {
        window.open(result.url, "_blank", "noopener");
      }
      setNotice("Login-Seite geöffnet. Nach der Freigabe den Code aus der URL hier einfügen.");
    });
  }

  async function handleExchange() {
    if (!code.trim()) {
      setError("Bitte zuerst den Spotify-Code einfügen.");
      return;
    }
    await run("exchange", async () => {
      const result = await onExchangeCode(code.trim());
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCode("");
      setAuthUrl(null);
      setNotice(result.message);
      setDevicesResult(await onLoadDevices());
    });
  }

  async function handleLoadDevices() {
    await run("devices", async () => {
      const result = await onLoadDevices();
      setDevicesResult(result);
      if (!result.ok && result.message) {
        setError(result.message);
      }
    });
  }

  async function handleSetDevice(deviceId: string | null) {
    await run("set-device", async () => {
      const result = await onSetDevice(deviceId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
      setDevicesResult(await onLoadDevices());
    });
  }

  async function handleTest(action: "play" | "pause") {
    await run(`test-${action}`, async () => {
      const result = await onTest(action);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
    });
  }

  async function handleDisconnect() {
    await run("disconnect", async () => {
      const result = await onDisconnect();
      setDevicesResult(null);
      setAuthUrl(null);
      setNotice(result.message);
    });
  }

  return (
    <div className="connector-stack">
      <CardV2
        title="Spotify-Zugangsdaten"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="primary" onClick={handleSave} disabled={disabled}>
              Zugangsdaten speichern
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Spotify OAuth läuft ausschließlich hier auf dem RTX-PC — der UWE-Host sieht die
            Zugangsdaten nie. Die Redirect-URI muss im Spotify-Developer-Dashboard registriert sein.
          </p>

          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          {notice ? <div className="connector-banner connector-banner-success">{notice}</div> : null}

          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Client ID</span>
              <input
                className="connector-input"
                value={config.spotifyClientId}
                onChange={(event) => onChange("spotifyClientId", event.target.value)}
                placeholder="Spotify App Client ID"
              />
            </label>

            <label className="connector-field">
              <span>Client Secret</span>
              <input
                className="connector-input"
                type="password"
                value={config.spotifyClientSecret}
                onChange={(event) => onChange("spotifyClientSecret", event.target.value)}
                placeholder="Spotify App Client Secret"
              />
            </label>

            <label className="connector-field connector-field-full">
              <span>Redirect URI</span>
              <input
                className="connector-input"
                value={config.spotifyRedirectUri}
                onChange={(event) => onChange("spotifyRedirectUri", event.target.value)}
                placeholder="http://127.0.0.1:8742/callback"
              />
            </label>
          </div>
        </div>
      </CardV2>

      <CardV2
        title="Anmeldung"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="secondary" onClick={handleAuthUrl} disabled={disabled}>
              Login öffnen
            </ButtonV2>
            <ButtonV2 variant="primary" onClick={handleExchange} disabled={disabled}>
              Code eintauschen
            </ButtonV2>
            {connected ? (
              <ButtonV2 variant="ghost" onClick={handleDisconnect} disabled={disabled}>
                Trennen
              </ButtonV2>
            ) : null}
          </div>
        }
      >
        <div className="connector-stack">
          <HealthBadge
            status={connected ? "ok" : "degraded"}
            label={connected ? "Verbunden" : "Nicht verbunden"}
          />
          <p className="connector-muted">
            „Login öffnen“ öffnet die Spotify-Freigabeseite. Nach „Agree“ den Wert des{" "}
            <code>code</code>-Parameters aus der Weiterleitungs-URL kopieren und unten einfügen.
          </p>

          {authUrl ? (
            <label className="connector-field connector-field-full">
              <span>Login-URL (falls sich kein Browser öffnet)</span>
              <input className="connector-input" value={authUrl} readOnly />
            </label>
          ) : null}

          <label className="connector-field connector-field-full">
            <span>Authorization Code</span>
            <input
              className="connector-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="AQD… (code-Parameter aus der Redirect-URL)"
            />
          </label>
        </div>
      </CardV2>

      <CardV2
        title="Ausgabegerät & Test"
        footer={
          <div className="connector-actions">
            <ButtonV2 variant="ghost" onClick={handleLoadDevices} disabled={disabled}>
              Geräte laden
            </ButtonV2>
            <ButtonV2 variant="secondary" onClick={() => handleTest("play")} disabled={disabled}>
              Test: Play
            </ButtonV2>
            <ButtonV2 variant="secondary" onClick={() => handleTest("pause")} disabled={disabled}>
              Test: Pause
            </ButtonV2>
          </div>
        }
      >
        <div className="connector-stack">
          <p className="connector-muted">
            Wähle das Spotify-Connect-Gerät auf dem RTX-PC (z. B. die laufende Spotify-App). Spotify
            Premium ist für die Wiedergabesteuerung erforderlich.
          </p>

          {devicesResult && devicesResult.devices.length === 0 ? (
            <div className="connector-empty-state">
              {devicesResult.connected
                ? "Keine aktiven Spotify-Connect-Geräte gefunden — Spotify-App auf dem RTX-PC starten."
                : "Noch nicht verbunden."}
            </div>
          ) : null}

          {devicesResult && devicesResult.devices.length > 0 ? (
            <div className="connector-profile-list">
              {devicesResult.devices.map((device) => {
                const isPreferred = devicesResult.deviceId === device.id;
                return (
                  <div key={device.id} className="connector-inline-card">
                    <div className="connector-inline-card-header">
                      <div>
                        <p className="connector-lead">
                          {device.name}
                          {isPreferred ? " · bevorzugt" : ""}
                        </p>
                        <p className="connector-muted">
                          {device.type}
                          {device.volumePercent !== null ? ` · ${device.volumePercent}%` : ""}
                          {device.isActive ? " · aktiv" : ""}
                        </p>
                      </div>
                      <ButtonV2
                        variant={isPreferred ? "ghost" : "secondary"}
                        onClick={() => handleSetDevice(device.id)}
                        disabled={disabled || isPreferred}
                      >
                        Auswählen
                      </ButtonV2>
                    </div>
                  </div>
                );
              })}
              {devicesResult.deviceId ? (
                <ButtonV2 variant="ghost" onClick={() => handleSetDevice(null)} disabled={disabled}>
                  Gerät zurücksetzen
                </ButtonV2>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardV2>
    </div>
  );
}
