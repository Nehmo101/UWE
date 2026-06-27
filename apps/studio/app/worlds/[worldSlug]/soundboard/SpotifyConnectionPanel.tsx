"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number | null;
}

interface SpotifyStatusResponse {
  configured: boolean;
  connected: boolean;
  /** "rtx-connector" when Spotify is served by the RTX Connector Client. */
  via?: string | null;
  spotifyDisplayName?: string | null;
  preferredDeviceId?: string | null;
  preferredDeviceName?: string | null;
  message?: string;
}

interface Props {
  worldSlug: string;
}

export function SpotifyConnectionPanel({ worldSlug }: Props) {
  const [status, setStatus] = useState<SpotifyStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [savingDevice, setSavingDevice] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(studioApiUrl(`/api/worlds/${encodeURIComponent(worldSlug)}/spotify/status`));
      const payload = (await response.json()) as SpotifyStatusResponse;
      setStatus(payload);
    } catch {
      setError("Spotify-Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [worldSlug]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch(
        studioApiUrl(`/api/worlds/${encodeURIComponent(worldSlug)}/spotify/disconnect`),
        { method: "POST" },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Trennen fehlgeschlagen.");
      }

      await loadStatus();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error ? disconnectError.message : "Trennen fehlgeschlagen.",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOpenDevicePicker = async () => {
    setShowDevicePicker(true);
    setDeviceError(null);
    setLoadingDevices(true);

    try {
      const response = await fetch(
        studioApiUrl(`/api/worlds/${encodeURIComponent(worldSlug)}/spotify/devices`),
      );
      const payload = (await response.json()) as { ok: boolean; devices?: SpotifyDevice[]; message?: string };

      if (!payload.ok || !payload.devices) {
        setDeviceError(payload.message ?? "Geräteliste konnte nicht geladen werden.");
        setDevices([]);
      } else {
        setDevices(payload.devices);
      }
    } catch {
      setDeviceError("Spotify-Geräteliste konnte nicht abgerufen werden.");
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleSelectDevice = async (device: SpotifyDevice | null) => {
    setSavingDevice(true);
    setDeviceError(null);

    try {
      const response = await fetch(
        studioApiUrl(`/api/worlds/${encodeURIComponent(worldSlug)}/spotify/device`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: device?.id ?? null,
            deviceName: device?.name ?? null,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Gerät konnte nicht gespeichert werden.");
      }

      setShowDevicePicker(false);
      await loadStatus();
    } catch (saveError) {
      setDeviceError(
        saveError instanceof Error ? saveError.message : "Gerät konnte nicht gespeichert werden.",
      );
    } finally {
      setSavingDevice(false);
    }
  };

  const deviceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      Computer: "Computer",
      Smartphone: "Smartphone",
      Speaker: "Lautsprecher",
      TV: "TV",
      AVR: "AV-Receiver",
      STB: "Set-Top-Box",
      AudioDongle: "Audio-Dongle",
      GameConsole: "Spielkonsole",
      CastVideo: "Cast Video",
      CastAudio: "Cast Audio",
      Automobile: "Auto",
    };
    return labels[type] ?? type;
  };

  const connectorActive = status?.via === "rtx-connector";

  return (
    <section className="uwe-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2>Spotify</h2>
          <p className="uwe-table-sub" style={{ margin: 0 }}>
            Spotify wird im RTX Connector Client eingerichtet — das Soundboard sendet die
            Wiedergabe als Connector-Job an den RTX-PC.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!loading && !connectorActive && status?.configured && status.connected && (
            <>
              <button
                type="button"
                className="uwe-v2-btn"
                onClick={() => void handleOpenDevicePicker()}
                disabled={showDevicePicker}
              >
                Gerät wählen
              </button>
              <button
                type="button"
                className="uwe-v2-btn"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
              >
                {disconnecting ? "Trenne …" : "Verbindung trennen"}
              </button>
            </>
          )}
        </div>
      </div>

      {loading && <p className="uwe-table-sub">Spotify-Status wird geladen …</p>}

      {!loading && connectorActive && (
        <p className="uwe-flash uwe-flash-success">
          Spotify läuft über den <strong>RTX Connector Client</strong>. Anmeldung und Ausgabegerät
          werden dort im Spotify-Panel verwaltet — der Host hält keine Spotify-Tokens.
        </p>
      )}

      {!loading && !connectorActive && status && !status.configured && (
        <div className="uwe-flash uwe-flash-error" role="alert">
          <p style={{ margin: 0 }}>
            {status.message ??
              "Spotify wird im RTX Connector Client eingerichtet (Client-ID/Secret hinterlegen und anmelden)."}
          </p>
          <p className="uwe-table-sub" style={{ margin: "0.5rem 0 0" }}>
            Öffne den RTX Connector Client → Spotify, hinterlege Client-ID/Secret, melde dich an und
            wähle das Ausgabegerät. Sobald der Connector online ist, wird er hier automatisch als
            Spotify-Backend erkannt.
          </p>
        </div>
      )}

      {!loading && !connectorActive && status?.configured && status.connected && (
        <p className="uwe-flash uwe-flash-success">
          Verbunden als {status.spotifyDisplayName ?? "Spotify-Nutzer"}.
          {status.preferredDeviceName && (
            <> Ausgabegerät: <strong>{status.preferredDeviceName}</strong>.</>
          )}
          {!status.preferredDeviceName && (
            <> Kein Ausgabegerät gewählt — Wiedergabe läuft auf dem aktuell aktiven Gerät.</>
          )}
        </p>
      )}

      {!loading && !connectorActive && status?.configured && !status.connected && (
        <p className="uwe-table-sub">
          Noch nicht verbunden. Spotify Premium und ein aktives Wiedergabegerät (App oder Webplayer) sind nötig.
        </p>
      )}

      {error && (
        <p className="uwe-flash uwe-flash-error" role="alert">
          {error}
        </p>
      )}

      {showDevicePicker && (
        <div style={{ marginTop: "1rem", border: "1px solid var(--uwe-border, #ddd)", borderRadius: "6px", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong>Ausgabegerät wählen (RTX-Host oder anderes Spotify-Connect-Gerät)</strong>
            <button
              type="button"
              className="uwe-v2-btn"
              onClick={() => setShowDevicePicker(false)}
              disabled={savingDevice}
            >
              Schließen
            </button>
          </div>

          {loadingDevices && <p className="uwe-table-sub">Geräteliste wird geladen …</p>}

          {deviceError && (
            <p className="uwe-flash uwe-flash-error" role="alert">
              {deviceError}
            </p>
          )}

          {!loadingDevices && devices.length === 0 && !deviceError && (
            <p className="uwe-table-sub">
              Keine aktiven Spotify-Connect-Geräte gefunden. Spotify-App auf dem RTX-Host oder einem anderen Gerät starten.
            </p>
          )}

          {!loadingDevices && devices.length > 0 && (
            <table className="uwe-page-table" style={{ marginBottom: "0.75rem" }}>
              <thead>
                <tr>
                  <th>Gerätename</th>
                  <th>Typ</th>
                  <th>Lautstärke</th>
                  <th>Status</th>
                  <th>Auswählen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.id}
                    style={
                      status?.preferredDeviceId === device.id
                        ? { background: "var(--uwe-highlight, #f0f8ff)" }
                        : undefined
                    }
                  >
                    <td>
                      {device.name}
                      {status?.preferredDeviceId === device.id && (
                        <span style={{ marginLeft: "0.5rem", color: "var(--uwe-accent, #1db954)", fontSize: "0.8em" }}>
                          ✓ bevorzugt
                        </span>
                      )}
                    </td>
                    <td>{deviceTypeLabel(device.type)}</td>
                    <td>{device.volumePercent !== null ? `${device.volumePercent}%` : "—"}</td>
                    <td>{device.isActive ? "Aktiv" : "Inaktiv"}</td>
                    <td>
                      <button
                        type="button"
                        className="uwe-v2-btn"
                        onClick={() => void handleSelectDevice(device)}
                        disabled={savingDevice || status?.preferredDeviceId === device.id}
                      >
                        {savingDevice ? "Speichere …" : "Auswählen"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {status?.preferredDeviceId && (
            <button
              type="button"
              className="uwe-v2-btn"
              onClick={() => void handleSelectDevice(null)}
              disabled={savingDevice}
            >
              Gerät zurücksetzen (aktives Gerät verwenden)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
