"use client";

/**
 * RegionDescribePanel — P7 Atlas region AI description.
 *
 * Opened when the DM clicks "✦ Beschreiben" on a selected region feature.
 * Calls /api/brain/run with atlas_describe_region, shows the result in a
 * read-only panel, and lets the DM copy or dismiss — never auto-applied.
 */

import { useState } from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";

/** Minimal region shape the describe panel needs (decoupled from the editor). */
export interface RegionDescribeTarget {
  labelText?: string | null;
  kind: string;
}

export interface RegionDescribePanelProps {
  worldSlug: string;
  feature: RegionDescribeTarget;
  onClose: () => void;
}

export function RegionDescribePanel({
  worldSlug,
  feature,
  onClose,
}: RegionDescribePanelProps) {
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("gemma3:4b");
  const [contextHint, setContextHint] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [resultText, setResultText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const regionLabel = feature.labelText || `Region (${feature.kind})`;

  async function handleDescribe() {
    setStatus("running");
    setResultText(null);
    setErrorMsg(null);

    const userPromptParts = [
      `Region: ${regionLabel}`,
      `Kartenebene/Art: ${feature.kind}`,
      contextHint.trim() ? `Zusätzlicher Kontext: ${contextHint.trim()}` : "",
      "",
      "Schreibe eine atmosphärische DM-Beschreibung dieser Kartenregion (2–4 Absätze) und einen kurzen Spieler-Flavortext (1–2 Sätze).",
    ]
      .filter((l, i) => i === 0 || l || i > 2)
      .join("\n");

    try {
      const response = await fetch(studioApiUrl("/api/brain/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: "atlas_describe_region",
          worldSlug,
          providerId: provider,
          model,
          userPrompt: userPromptParts,
          allowDmOnly: true,
          useMock: model === "mock-model" || process.env.NEXT_PUBLIC_AI_USE_MOCK === "true",
          sync: true,
        }),
      });
      const data = await response.json() as {
        run?: { resultText?: string | null };
        proposals?: Array<{ content: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "KI-Aktion fehlgeschlagen");
      }
      const text = data.run?.resultText ?? data.proposals?.[0]?.content ?? "";
      setResultText(text || "Kein Ergebnis erhalten.");
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fehler");
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--uwe-bg)",
          border: "1px solid var(--uwe-border)",
          borderRadius: "var(--uwe-radius)",
          padding: "1.5rem",
          minWidth: "min(380px, calc(100vw - 2rem))",
          maxWidth: "min(640px, calc(100vw - 2rem))",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Region beschreiben — KI-Entwurf</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--uwe-muted)" }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-muted)" }}>
          Region: <strong>{regionLabel}</strong> — Beschreibungsvorschlag (nie automatisch im Kanon)
        </p>

        {/* Config */}
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--uwe-muted)" }}>
            KI konfigurieren
          </summary>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              Provider
              <select
                className="uwe-input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="ollama">Ollama (lokal)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              Modell
              <input
                className="uwe-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="z.B. gemma3:4b"
                style={{ fontSize: 12, width: 160 }}
              />
            </label>
          </div>
        </details>

        {/* Context hint */}
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
          Zusätzlicher Kontext (optional)
          <input
            className="uwe-input"
            value={contextHint}
            onChange={(e) => setContextHint(e.target.value)}
            placeholder="z.B. Eisige Tundra, Hauptsitz der Ork-Stämme"
          />
        </label>

        {/* Run button */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={() => void handleDescribe()}
            disabled={status === "running"}
            style={{ flex: 1 }}
          >
            {status === "running" ? "Beschreibe…" : "✦ Beschreibung generieren"}
          </button>
        </div>

        {/* Error */}
        {status === "error" && errorMsg && (
          <p style={{ color: "var(--uwe-danger)", fontSize: 13, margin: 0 }}>{errorMsg}</p>
        )}

        {/* Result */}
        {status === "done" && resultText && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13 }}>Vorschlag (Entwurf)</strong>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                style={{ fontSize: 12, padding: "0.15rem 0.5rem" }}
                onClick={() => void handleCopy()}
              >
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            </div>
            <pre
              style={{
                background: "var(--uwe-surface)",
                border: "1px solid var(--uwe-border)",
                borderRadius: 4,
                padding: "0.75rem",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 320,
                overflowY: "auto",
                margin: 0,
              }}
            >
              {resultText}
            </pre>
            <p style={{ fontSize: 11, color: "var(--uwe-muted)", margin: 0 }}>
              Dies ist ein KI-Vorschlag — kein Kanon. Kopieren und manuell in eine Wiki-Seite einfügen.
            </p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
