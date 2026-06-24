"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";

interface SpotifyStatusResponse {
  configured: boolean;
  connected: boolean;
  spotifyDisplayName?: string | null;
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

  return (
    <section className="uwe-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2>Spotify</h2>
          <p className="uwe-table-sub" style={{ margin: 0 }}>
            Verbinde ein Spotify-Premium-Konto pro Welt für Soundboard-Wiedergabe über die Web API.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!loading && status?.configured && !status.connected && (
            <a
              className="uwe-v2-btn"
              href={`/api/worlds/${encodeURIComponent(worldSlug)}/spotify/connect`}
            >
              Mit Spotify verbinden
            </a>
          )}
          {!loading && status?.connected && (
            <button
              type="button"
              className="uwe-v2-btn"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? "Trenne …" : "Verbindung trennen"}
            </button>
          )}
        </div>
      </div>

      {loading && <p className="uwe-table-sub">Spotify-Status wird geladen …</p>}

      {!loading && status && !status.configured && (
        <p className="uwe-flash uwe-flash-error" role="alert">
          {status.message ??
            "Spotify OAuth ist nicht konfiguriert. SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET und Redirect-URI setzen."}
        </p>
      )}

      {!loading && status?.configured && status.connected && (
        <p className="uwe-flash uwe-flash-success">
          Verbunden als {status.spotifyDisplayName ?? "Spotify-Nutzer"}.
        </p>
      )}

      {!loading && status?.configured && !status.connected && (
        <p className="uwe-table-sub">
          Noch nicht verbunden. Spotify Premium und ein aktives Wiedergabegerät (App oder Webplayer) sind nötig.
        </p>
      )}

      {error && (
        <p className="uwe-flash uwe-flash-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
