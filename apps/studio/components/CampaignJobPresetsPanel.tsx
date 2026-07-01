"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

interface WorldOption {
  id: string;
  name: string;
  slug: string;
}

interface SessionOption {
  id: string;
  title: string;
  sessionNumber: number;
}

export interface CampaignJobPresetView {
  id: string;
  label: string;
  description: string;
  kind: "job" | "brain_action";
  jobType?: string;
  brainActionId?: string;
  requiresSession?: boolean;
  requiresPage?: boolean;
  href?: string;
}

interface Props {
  presets: CampaignJobPresetView[];
  worlds: WorldOption[];
  sessionsByWorld: Record<string, SessionOption[]>;
}

function resolvePresetHref(preset: CampaignJobPresetView, worldSlug: string): string | undefined {
  if (!preset.href) return undefined;
  return preset.href.replace("{worldSlug}", worldSlug);
}

export function CampaignJobPresetsPanel({ presets, worlds, sessionsByWorld }: Props) {
  const [worldSlug, setWorldSlug] = useState(worlds[0]?.slug ?? "");
  const [sessionId, setSessionId] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessions = worldSlug ? (sessionsByWorld[worldSlug] ?? []) : [];

  async function runPreset(preset: CampaignJobPresetView) {
    if (!worldSlug) {
      setError("Bitte eine Welt auswählen.");
      return;
    }

    const dedicatedHref = resolvePresetHref(preset, worldSlug);
    if (preset.requiresSession && !sessionId && dedicatedHref) {
      setError(`Für „${preset.label}“ bitte Session wählen oder ${dedicatedHref} nutzen.`);
      return;
    }

    if (preset.requiresPage && !pageSlug.trim()) {
      setError(`Für „${preset.label}“ bitte einen Seiten-Slug angeben.`);
      return;
    }

    setBusyId(preset.id);
    setError(null);
    setMessage(null);

    try {
      if (preset.kind === "job" && preset.jobType) {
        const response = await fetch(studioApiUrl("/api/jobs"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: preset.jobType,
            title: `${preset.label} · ${worldSlug}`,
            worldSlug,
            payload: { worldSlug, force: preset.jobType === "reindex" },
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Job konnte nicht gestartet werden.");
        }
        setMessage(`Job „${preset.label}“ gestartet (${data.job?.id ?? "—"}).`);
        return;
      }

      if (preset.kind === "brain_action" && preset.brainActionId) {
        const response = await fetch(studioApiUrl("/api/brain/run"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionId: preset.brainActionId,
            worldSlug,
            sessionId: sessionId || undefined,
            pageSlug: pageSlug.trim() || undefined,
            providerId: "ollama",
            model: "llama3.2",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Brain-Aktion fehlgeschlagen.");
        }
        setMessage(
          data.job?.id
            ? `Brain-Job gestartet (${data.job.id}) — Ergebnis unter AI Runs prüfen.`
            : `Aktion „${preset.label}“ abgeschlossen.`,
        );
        return;
      }

      throw new Error("Preset-Konfiguration unvollständig.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  if (worlds.length === 0) {
    return (
      <section className="uwe-v2-card uwe-v2-section">
        <h2 className="uwe-v2-section-title">Kampagnen-Presets</h2>
        <p className="uwe-dashboard-muted">
          Lege zuerst eine Welt an, um 1-Klick-Jobs zu starten.{" "}
          <Link href="/worlds">Welten →</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Kampagnen-Presets</h2>
      <p className="uwe-dashboard-muted">
        1-Klick-Jobs für Kanonprüfung, Session-Vorbereitung und Brain-Reindex — laufen in der
        Warteschlange unten.
      </p>

      <div className="uwe-form" style={{ marginBottom: "1rem" }}>
        <label>
          Welt
          <select
            value={worldSlug}
            onChange={(event) => {
              setWorldSlug(event.target.value);
              setSessionId("");
            }}
          >
            {worlds.map((world) => (
              <option key={world.id} value={world.slug}>
                {world.name} ({world.slug})
              </option>
            ))}
          </select>
        </label>

        {sessions.length > 0 ? (
          <label>
            Session (optional)
            <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">— keine —</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  #{session.sessionNumber} {session.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          Seiten-Slug (für Handout-Preset)
          <input
            value={pageSlug}
            onChange={(event) => setPageSlug(event.target.value)}
            placeholder="z. B. lore/aldoria"
          />
        </label>
      </div>

      {error ? (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="uwe-notice" role="status">
          {message}
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
        {presets.map((preset) => {
          const href = worldSlug ? resolvePresetHref(preset, worldSlug) : undefined;
          return (
            <div key={preset.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <button
                type="button"
                className="uwe-v2-btn"
                disabled={busyId === preset.id}
                onClick={() => void runPreset(preset)}
                title={preset.description}
              >
                {busyId === preset.id ? "Startet…" : preset.label}
              </button>
              {href ? (
                <Link href={href} className="uwe-hint" style={{ fontSize: "0.85rem" }}>
                  Detail-UI →
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
