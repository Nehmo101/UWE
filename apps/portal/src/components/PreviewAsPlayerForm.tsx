"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PlayerOption {
  id: string;
  displayName: string;
  characterName: string | null;
}

interface PreviewAsPlayerFormProps {
  worldSlug: string;
  players: PlayerOption[];
  currentPreviewUserId: string | null;
}

export function PreviewAsPlayerForm({
  worldSlug,
  players,
  currentPreviewUserId,
}: PreviewAsPlayerFormProps) {
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
    <section className="auth-preview">
      <h2>Preview as Player</h2>
      <div className="auth-preview-controls">
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={loading}
        >
          <option value="">DM-Ansicht</option>
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
            Preview beenden
          </button>
        )}
      </div>
    </section>
  );
}
