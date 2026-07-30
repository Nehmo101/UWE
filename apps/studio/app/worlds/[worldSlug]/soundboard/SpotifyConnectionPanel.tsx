"use client";

import { ResponsiveTable, StatusPill } from "@uwe/shared-ui";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui";

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
  /** "rtx-connector" when Spotify is served by the UWE Command Center. */
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Spotify</CardTitle>
          <CardDescription>
            Spotify wird im UWE Command Center eingerichtet — das Soundboard sendet die
            Wiedergabe als Connector-Job an den RTX-PC.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!loading && !connectorActive && status?.configured && status.connected && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleOpenDevicePicker()}
                disabled={showDevicePicker}
              >
                Gerät wählen
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
              >
                {disconnecting ? "Trenne …" : "Verbindung trennen"}
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loading && <p className="text-sm text-muted-foreground">Spotify-Status wird geladen …</p>}

        {!loading && connectorActive && (
          <Alert tone="success">
            Spotify läuft über das <strong>UWE Command Center</strong>. Anmeldung und Ausgabegerät
            werden dort im Spotify-Panel verwaltet — der Host hält keine Spotify-Tokens.
          </Alert>
        )}

        {!loading && !connectorActive && status && !status.configured && (
          <Alert tone="danger" role="alert">
            <p>
              {status.message ??
                "Spotify wird im UWE Command Center eingerichtet (Client-ID/Secret hinterlegen und anmelden)."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Öffne das UWE Command Center → Spotify, hinterlege Client-ID/Secret, melde dich an und
              wähle das Ausgabegerät. Sobald der Connector online ist, wird er hier automatisch als
              Spotify-Backend erkannt.
            </p>
          </Alert>
        )}

        {!loading && !connectorActive && status?.configured && status.connected && (
          <Alert tone="success">
            Verbunden als {status.spotifyDisplayName ?? "Spotify-Nutzer"}.
            {status.preferredDeviceName && (
              <> Ausgabegerät: <strong>{status.preferredDeviceName}</strong>.</>
            )}
            {!status.preferredDeviceName && (
              <> Kein Ausgabegerät gewählt — Wiedergabe läuft auf dem aktuell aktiven Gerät.</>
            )}
          </Alert>
        )}

        {!loading && !connectorActive && status?.configured && !status.connected && (
          <p className="text-sm text-muted-foreground">
            Noch nicht verbunden. Spotify Premium und ein aktives Wiedergabegerät (App oder Webplayer) sind nötig.
          </p>
        )}

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}

        {showDevicePicker && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>Ausgabegerät wählen (RTX-Host oder anderes Spotify-Connect-Gerät)</strong>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDevicePicker(false)}
                  disabled={savingDevice}
                >
                  Schließen
                </Button>
              </div>

              {loadingDevices && <p className="text-sm text-muted-foreground">Geräteliste wird geladen …</p>}

              {deviceError && (
                <Alert tone="danger" role="alert">
                  {deviceError}
                </Alert>
              )}

              {!loadingDevices && devices.length === 0 && !deviceError && (
                <p className="text-sm text-muted-foreground">
                  Keine aktiven Spotify-Connect-Geräte gefunden. Spotify-App auf dem RTX-Host oder einem anderen Gerät starten.
                </p>
              )}

              {!loadingDevices && devices.length > 0 && (
                <ResponsiveTable
                  caption="Spotify-Connect-Geräte"
                  rowKey={(device) => device.id}
                  rows={devices}
                  columns={[
                    {
                      key: "name",
                      label: "Gerätename",
                      primary: true,
                      render: (device) => (
                        <>
                          {device.name}
                          {status?.preferredDeviceId === device.id && (
                            <Badge variant="success" className="ml-2">
                              Bevorzugt
                            </Badge>
                          )}
                        </>
                      ),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (device) => (
                        <StatusPill
                          glyph={device.isActive ? "▶" : "◻"}
                          tone={device.isActive ? "success" : "neutral"}
                        >
                          {device.isActive ? "Aktiv" : "Inaktiv"}
                        </StatusPill>
                      ),
                    },
                    { key: "type", label: "Typ", render: (device) => deviceTypeLabel(device.type) },
                    {
                      key: "volume",
                      label: "Lautstärke",
                      numeric: true,
                      render: (device) =>
                        device.volumePercent !== null ? `${device.volumePercent}%` : "—",
                    },
                    {
                      key: "select",
                      label: "Auswählen",
                      render: (device) => (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleSelectDevice(device)}
                          disabled={savingDevice || status?.preferredDeviceId === device.id}
                        >
                          {savingDevice ? "Speichere …" : "Auswählen"}
                        </Button>
                      ),
                    },
                  ]}
                />
              )}

              {status?.preferredDeviceId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSelectDevice(null)}
                  disabled={savingDevice}
                >
                  Gerät zurücksetzen (aktives Gerät verwenden)
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
