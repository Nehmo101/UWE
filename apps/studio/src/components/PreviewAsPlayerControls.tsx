"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PlayerOption {
  id: string;
  displayName: string;
  characterName: string | null;
}

interface PreviewAsPlayerControlsProps {
  worldSlug: string;
  players: PlayerOption[];
  currentPreviewUserId: string | null;
}

export function PreviewAsPlayerControls({
  worldSlug,
  players,
  currentPreviewUserId,
}: PreviewAsPlayerControlsProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentPreviewUserId ?? "");
  const [loading, setLoading] = useState(false);

  async function applyPreview(previewAsUserId: string | null) {
    setLoading(true);
    await fetch("/api/auth/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldSlug, previewAsUserId }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-xs font-medium" htmlFor="preview-as-player">
        Spieler-Perspektive
      </label>
      <div className="auth-preview-controls">
        <select
          id="preview-as-player"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={loading}
        >
          <option value="">Generische Spieler-Vorschau</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.characterName ?? player.displayName}
            </option>
          ))}
        </select>
        <button type="button" disabled={loading} onClick={() => applyPreview(selected || null)}>
          Anwenden
        </button>
        {currentPreviewUserId && (
          <button type="button" disabled={loading} onClick={() => applyPreview(null)}>
            Spieler-Preview beenden
          </button>
        )}
      </div>
    </div>
  );
}
