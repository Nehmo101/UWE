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
import { Button, Input, Label, NavIcon } from "@/src/components/ui";

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

/** TODO(design-kit): natives select bleibt — controlled Provider-Auswahl (State + onChange),
    siehe gleiches Muster in ReviewWorkspace.tsx / AuditLogWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-8 rounded-[var(--radius)] border border-input bg-transparent px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] min-w-[min(380px,calc(100vw-2rem))] max-w-[min(640px,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-[var(--radius)] border border-border bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">Region beschreiben — KI-Entwurf</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
            <NavIcon name="x" width={18} height={18} />
          </Button>
        </div>

        <p className="m-0 text-sm text-muted-foreground">
          Region: <strong>{regionLabel}</strong> — Beschreibungsvorschlag (nie automatisch im Kanon)
        </p>

        {/* Config */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">KI konfigurieren</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="region-describe-provider" className="text-xs font-normal">
                Provider
              </Label>
              <select
                id="region-describe-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="ollama">Ollama (lokal)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="region-describe-model" className="text-xs font-normal">
                Modell
              </Label>
              <Input
                id="region-describe-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="z.B. gemma3:4b"
                className="h-8 w-40 text-xs"
              />
            </div>
          </div>
        </details>

        {/* Context hint */}
        <div className="flex flex-col gap-1.5 text-sm">
          <Label htmlFor="region-describe-context">Zusätzlicher Kontext (optional)</Label>
          <Input
            id="region-describe-context"
            value={contextHint}
            onChange={(e) => setContextHint(e.target.value)}
            placeholder="z.B. Eisige Tundra, Hauptsitz der Ork-Stämme"
          />
        </div>

        {/* Run button */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => void handleDescribe()}
            disabled={status === "running"}
            className="flex-1"
          >
            {status === "running" ? (
              "Beschreibe…"
            ) : (
              <>
                <NavIcon name="sparkles" width={16} height={16} />
                Beschreibung generieren
              </>
            )}
          </Button>
        </div>

        {/* Error */}
        {status === "error" && errorMsg && <p className="m-0 text-sm text-destructive">{errorMsg}</p>}

        {/* Result */}
        {status === "done" && resultText && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <strong className="text-sm">Vorschlag (Entwurf)</strong>
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
                {copied ? (
                  <>
                    <NavIcon name="check" width={14} height={14} />
                    Kopiert
                  </>
                ) : (
                  "Kopieren"
                )}
              </Button>
            </div>
            <pre className="m-0 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-3 text-sm leading-relaxed">
              {resultText}
            </pre>
            <p className="m-0 text-xs text-muted-foreground">
              Dies ist ein KI-Vorschlag — kein Kanon. Kopieren und manuell in eine Wiki-Seite einfügen.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  );
}
