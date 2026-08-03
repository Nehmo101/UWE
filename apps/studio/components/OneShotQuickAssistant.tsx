"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { ONE_SHOT_TONE_LABELS, type OneShotTone } from "@uwe/ai-brain/one-shot";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from "@/src/components/ui";

interface LocationOption {
  title: string;
}

interface Props {
  worldSlug: string;
  locations: LocationOption[];
  engineReady: boolean;
  engineEnabled: boolean;
}

const QUICK_PRESETS: Array<{ label: string; tone: OneShotTone }> = [
  { label: "Mystery", tone: "mystery" },
  { label: "Horror", tone: "horror" },
  { label: "Düster", tone: "duester" },
  { label: "Lustig", tone: "lustig" },
];

/** TODO(design-kit): natives select bleibt — controlled Ort-/Ton-Auswahl ohne Kit-Select,
    siehe gleiches Muster in ReviewWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function OneShotQuickAssistant({
  worldSlug,
  locations,
  engineReady,
  engineEnabled,
}: Props) {
  const router = useRouter();
  const [location, setLocation] = useState(locations[0]?.title ?? "");
  const [tone, setTone] = useState<OneShotTone>("mystery");
  const [aiPrompt, setAiPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function navigateGenerate(nextLocation: string, nextTone: OneShotTone) {
    const params = new URLSearchParams({
      location: nextLocation,
      tone: nextTone,
    });
    router.push(`/worlds/${worldSlug}/one-shot?${params.toString()}`);
  }

  async function runAiAssist() {
    if (!location.trim()) {
      setStatus("Bitte zuerst einen Ort wählen.");
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch(studioApiUrl("/api/brain/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: "expand_knowledge",
          worldSlug,
          providerId: "ollama",
          model: "llama3.2",
          userPrompt:
            aiPrompt.trim() ||
            `Erstelle Ideen für einen One-Shot in ${location} im Ton ${ONE_SHOT_TONE_LABELS[tone]}. Spieler-Brief und DM-Geheimnisse getrennt halten.`,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        job?: { id: string; status?: string };
        run?: { id: string };
      };

      if (!response.ok) {
        setStatus(payload.error ?? "KI-Assistent fehlgeschlagen.");
        return;
      }

      if (response.status === 202) {
        setStatus(
          payload.job?.status === "deferred"
            ? "Maschinenraum offline — Vorschlag wird vorgemerkt. Ergebnis unter AI Runs."
            : "KI-Assistent läuft — Ergebnis unter AI Runs prüfen.",
        );
        return;
      }

      setStatus("Vorschlag erstellt — unter AI Runs prüfen.");
    } catch {
      setStatus("Netzwerkfehler beim KI-Assistenten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schnell-Assistent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Ort und Ton wählen, sofort das Regel-Gerüst erzeugen — optional mit Maschinenraum-KI
          ausbauen.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="one-shot-location">Ort</Label>
            <select
              id="one-shot-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="">— wählen —</option>
              {locations.map((loc) => (
                <option key={loc.title} value={loc.title}>
                  {loc.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="one-shot-tone">Ton</Label>
            <select
              id="one-shot-tone"
              value={tone}
              onChange={(event) => setTone(event.target.value as OneShotTone)}
              className={NATIVE_SELECT_CLASS}
            >
              {QUICK_PRESETS.map((preset) => (
                <option key={preset.tone} value={preset.tone}>
                  {ONE_SHOT_TONE_LABELS[preset.tone]}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" disabled={!location} onClick={() => navigateGenerate(location, tone)}>
            Gerüst generieren
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.tone}
              type="button"
              variant="outline"
              size="sm"
              disabled={!location}
              onClick={() => navigateGenerate(location, preset.tone)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <details>
          <summary className="cursor-pointer text-sm font-medium">KI-Ausbau (Maschinenraum, optional)</summary>
          <div className="mt-3 flex flex-col gap-2">
            {!engineEnabled ? (
              <Alert tone="danger" role="alert">
                Maschinenraum-Inference ist deaktiviert.
              </Alert>
            ) : engineEnabled && !engineReady ? (
              <p className="text-sm text-muted-foreground">Maschinenraum offline — wird als Job vorgemerkt.</p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="one-shot-ai-prompt">Zusätzliche Anweisungen</Label>
              <Textarea
                id="one-shot-ai-prompt"
                rows={2}
                value={aiPrompt}
                placeholder="z. B. mehr Sozial-Szenen, ein Twist mit Verräter …"
                onChange={(event) => setAiPrompt(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!engineEnabled || busy || !location}
                onClick={() => void runAiAssist()}
              >
                {busy ? "Läuft…" : "Mit KI ausbauen"}
              </Button>
              <Link href={`/worlds/${worldSlug}/ai-runs`} className={buttonVariants({ variant: "outline" })}>
                AI Runs →
              </Link>
            </div>
          </div>
        </details>

        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
