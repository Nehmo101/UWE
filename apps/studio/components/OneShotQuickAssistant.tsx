"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { ONE_SHOT_TONE_LABELS, type OneShotTone } from "@uwe/ai-brain/one-shot";

interface LocationOption {
  title: string;
}

interface Props {
  worldSlug: string;
  locations: LocationOption[];
  rtxReady: boolean;
  rtxEnabled: boolean;
}

const QUICK_PRESETS: Array<{ label: string; tone: OneShotTone }> = [
  { label: "Mystery", tone: "mystery" },
  { label: "Horror", tone: "horror" },
  { label: "Düster", tone: "duester" },
  { label: "Lustig", tone: "lustig" },
];

export function OneShotQuickAssistant({
  worldSlug,
  locations,
  rtxReady,
  rtxEnabled,
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
            ? "RTX offline — Vorschlag wird vorgemerkt. Ergebnis unter AI Runs."
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
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Schnell-Assistent</h2>
      <p className="uwe-dashboard-muted">
        Ort und Ton wählen, sofort das Regel-Gerüst erzeugen — optional mit RTX-KI
        ausbauen.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
        <label>
          Ort
          <select value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">— wählen —</option>
            {locations.map((loc) => (
              <option key={loc.title} value={loc.title}>
                {loc.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ton
          <select value={tone} onChange={(event) => setTone(event.target.value as OneShotTone)}>
            {QUICK_PRESETS.map((preset) => (
              <option key={preset.tone} value={preset.tone}>
                {ONE_SHOT_TONE_LABELS[preset.tone]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-primary"
          disabled={!location}
          onClick={() => navigateGenerate(location, tone)}
        >
          Gerüst generieren
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.75rem" }}>
        {QUICK_PRESETS.map((preset) => (
          <button
            key={preset.tone}
            type="button"
            className="uwe-v2-btn uwe-v2-btn-small"
            disabled={!location}
            onClick={() => navigateGenerate(location, preset.tone)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer" }}>KI-Ausbau (RTX, optional)</summary>
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {!rtxEnabled ? (
            <p className="uwe-form-error">RTX-Inference ist deaktiviert.</p>
          ) : rtxEnabled && !rtxReady ? (
            <p className="uwe-hint">RTX offline — wird als Job vorgemerkt.</p>
          ) : null}
          <label>
            Zusätzliche Anweisungen
            <textarea
              rows={2}
              value={aiPrompt}
              placeholder="z. B. mehr Sozial-Szenen, ein Twist mit Verräter …"
              onChange={(event) => setAiPrompt(event.target.value)}
            />
          </label>
          <div className="uwe-form-actions">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              disabled={!rtxEnabled || busy || !location}
              onClick={() => void runAiAssist()}
            >
              {busy ? "Läuft…" : "Mit KI ausbauen"}
            </button>
            <Link href={`/worlds/${worldSlug}/ai-runs`} className="uwe-v2-btn">
              AI Runs →
            </Link>
          </div>
        </div>
      </details>

      {status ? <p className="uwe-hint">{status}</p> : null}
    </section>
  );
}
