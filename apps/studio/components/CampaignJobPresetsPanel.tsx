"use client";

import Link from "next/link";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/src/components/ui";

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

/** TODO(design-kit): natives select bleibt — controlled Welt-/Session-Auswahl ohne Kit-Select,
    siehe gleiches Muster in ReviewWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
      <Card>
        <CardHeader>
          <CardTitle>Kampagnen-Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Lege zuerst eine Welt an, um 1-Klick-Jobs zu starten.{" "}
            <Link href="/worlds" className="text-primary underline-offset-4 hover:underline">
              Welten →
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kampagnen-Presets</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          1-Klick-Jobs für Kanonprüfung, Session-Vorbereitung und Brain-Reindex — laufen in der
          Warteschlange unten.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-presets-world">Welt</Label>
            <select
              id="campaign-presets-world"
              value={worldSlug}
              onChange={(event) => {
                setWorldSlug(event.target.value);
                setSessionId("");
              }}
              className={NATIVE_SELECT_CLASS}
            >
              {worlds.map((world) => (
                <option key={world.id} value={world.slug}>
                  {world.name} ({world.slug})
                </option>
              ))}
            </select>
          </div>

          {sessions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-presets-session">Session (optional)</Label>
              <select
                id="campaign-presets-session"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">— keine —</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    #{session.sessionNumber} {session.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-presets-page-slug">Seiten-Slug (für Handout-Preset)</Label>
            <Input
              id="campaign-presets-page-slug"
              value={pageSlug}
              onChange={(event) => setPageSlug(event.target.value)}
              placeholder="z. B. lore/aldoria"
            />
          </div>
        </div>

        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert tone="success" role="status">
            {message}
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {presets.map((preset) => {
            const href = worldSlug ? resolvePresetHref(preset, worldSlug) : undefined;
            return (
              <div key={preset.id} className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId === preset.id}
                  onClick={() => void runPreset(preset)}
                  title={preset.description}
                >
                  {busyId === preset.id ? "Startet…" : preset.label}
                </Button>
                {href ? (
                  <Link
                    href={href}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Detail-UI →
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
