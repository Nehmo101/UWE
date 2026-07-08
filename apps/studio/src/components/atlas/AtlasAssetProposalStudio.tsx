"use client";

/**
 * AtlasAssetProposalStudio — RTX-Asset-Studio MVP (review-only).
 *
 * Modal dialog beside the embedded Atlas editor:
 *   1. DM describes a Gouache asset (bounded prompt); the styleguide/catalog
 *      context is injected server-side by the brain action.
 *   2. generateAtlasAssetProposalAction runs atlas_generate_asset_proposal on
 *      a local/RTX provider and re-validates the output server-side.
 *   3. The validated proposal is shown as JSON/metadata preview; invalid
 *      output shows the validator issues instead.
 *   4. "Als Pending-Asset speichern" stores it as a pending AtlasPaletteItem
 *      via saveAtlasAssetProposalAction — never auto-applied, no AtlasObject.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RtxAtlasAssetProposal } from "@uwe/atlas/rtx-asset-proposal";
import {
  generateAtlasAssetProposalAction,
  saveAtlasAssetProposalAction,
  type AtlasAssetProposalIssueView,
} from "@/app/atlas-asset-actions";
import { RtxAssetRecipePreview } from "./RtxAssetRecipePreview";

export interface AtlasAssetProposalStudioProps {
  worldSlug: string;
  onClose: () => void;
  /** Prefill the prompt (e.g. from an editor "Asset fehlt?" wish). */
  initialPrompt?: string;
}

const MAX_PROMPT_LENGTH = 500;

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  color: "var(--uwe-muted)",
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.1rem 0.5rem",
  border: "1px solid var(--uwe-border)",
  borderRadius: 999,
  fontSize: 11,
  background: "var(--uwe-surface)",
};

export function AtlasAssetProposalStudio({ worldSlug, onClose, initialPrompt = "" }: AtlasAssetProposalStudioProps) {
  const router = useRouter();

  const [prompt, setPrompt] = useState(initialPrompt.slice(0, MAX_PROMPT_LENGTH));
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("gemma3:4b");

  const [proposal, setProposal] = useState<RtxAtlasAssetProposal | null>(null);
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [issues, setIssues] = useState<AtlasAssetProposalIssueView[]>([]);
  const [rawText, setRawText] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [isGenerating, startGenerateTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const resetResult = useCallback(() => {
    setProposal(null);
    setRunId(undefined);
    setWarnings([]);
    setProviderUsed(null);
    setGenerateError(null);
    setIssues([]);
    setRawText(null);
    setSaveError(null);
    setSaveSuccess(null);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    resetResult();

    startGenerateTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("prompt", prompt.trim());
      fd.set("providerId", provider);
      fd.set("model", model);
      try {
        const result = await generateAtlasAssetProposalAction(fd);
        if ("proposal" in result && result.proposal) {
          setProposal(result.proposal);
          setRunId(result.runId);
          setWarnings(result.warnings);
          setProviderUsed(result.providerUsed);
        } else {
          setGenerateError(result.error ?? "Asset-Proposal fehlgeschlagen.");
          setIssues(result.issues ?? []);
          setRawText(result.rawText ?? null);
          setRunId(result.runId);
        }
      } catch (error) {
        setGenerateError(error instanceof Error ? error.message : "Asset-Proposal fehlgeschlagen.");
      }
    });
  }, [model, prompt, provider, resetResult, worldSlug]);

  const handleSave = useCallback(() => {
    if (!proposal) return;
    setSaveError(null);
    setSaveSuccess(null);

    startSaveTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("proposal", JSON.stringify(proposal));
      if (runId) fd.set("runId", runId);
      try {
        const result = await saveAtlasAssetProposalAction(fd);
        if ("savedId" in result && result.savedId) {
          setSaveSuccess(
            `„${result.name}" als Pending-Asset gespeichert (ausstehende Genehmigung).`,
          );
          router.refresh();
        } else {
          const detail = result.issues?.[0]
            ? ` (${result.issues[0].path}: ${result.issues[0].message})`
            : "";
          setSaveError(`${result.error ?? "Speichern fehlgeschlagen."}${detail}`);
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
      }
    });
  }, [proposal, router, runId, worldSlug]);

  const proposalJson = proposal ? JSON.stringify(proposal, null, 2) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
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
          minWidth: "min(480px, calc(100vw - 2rem))",
          maxWidth: "min(760px, calc(100vw - 2rem))",
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
          <h2 style={{ margin: 0, fontSize: 18 }}>RTX-Asset-Studio — Gouache-Asset vorschlagen</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--uwe-muted)" }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "var(--uwe-muted)" }}>
          Styleguide (<code>docs/prompts/atlas-pictogram-styleguide.md</code>) und Asset-Katalog
          werden serverseitig in den Prompt injiziert. Das Ergebnis ist ein validiertes
          Review-Proposal — nie Auto-Apply, kein Code.
        </p>

        {/* Prompt */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label htmlFor="rtx-asset-prompt" style={sectionLabel}>
            Asset-Beschreibung (z.B. „verwunschener Leuchtturm auf Klippe, Landmarke“)
          </label>
          <textarea
            id="rtx-asset-prompt"
            className="uwe-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
            rows={3}
            placeholder="Beschreibe das gewünschte Gouache-Asset…"
            autoFocus
            style={{ resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--uwe-muted)" }}>
            <span>Gouache-Stil · gedämpfte Kartenpalette · Base-centre-Anker</span>
            <span>{prompt.length}/{MAX_PROMPT_LENGTH}</span>
          </div>
        </div>

        {/* Provider config — local/RTX only */}
        <details style={{ fontSize: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--uwe-muted)" }}>
            KI konfigurieren (nur lokal/RTX)
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
                <option value="openai_compatible">OpenAI-kompatibel (lokal/RTX)</option>
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

        {/* Generate */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            style={{ flex: 1 }}
          >
            {isGenerating ? "Generiere Proposal…" : "✦ Asset-Proposal generieren"}
          </button>
        </div>

        {/* Validation failure: error + issues + raw output */}
        {generateError && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--uwe-danger)",
                padding: "0.5rem",
                background: "var(--uwe-danger-10, rgba(220,38,38,0.08))",
                borderRadius: 4,
              }}
            >
              ✕ {generateError}
            </p>
            {issues.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: 12, color: "var(--uwe-danger)" }}>
                {issues.map((issue, index) => (
                  <li key={index}>
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {rawText && (
              <details style={{ fontSize: 12 }}>
                <summary style={{ cursor: "pointer", color: "var(--uwe-muted)" }}>
                  Rohausgabe anzeigen (verworfen)
                </summary>
                <pre
                  style={{
                    background: "var(--uwe-surface)",
                    border: "1px solid var(--uwe-border)",
                    borderRadius: 4,
                    padding: "0.5rem",
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 180,
                    overflowY: "auto",
                    margin: "0.4rem 0 0",
                  }}
                >
                  {rawText}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Validated proposal preview */}
        {proposal && proposalJson && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-success, #16a34a)" }}>
              ✓ Serverseitig validiert ({proposal.outputType})
              {providerUsed ? ` · Provider: ${providerUsed}` : ""}
            </p>
            {warnings.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: 12, color: "var(--uwe-muted)" }}>
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}>
              <strong style={{ fontSize: 14 }}>{proposal.name}</strong>
              <span style={chip}>{proposal.category}</span>
              {proposal.engineTags.map((tag) => (
                <span key={tag} style={chip}>{tag}</span>
              ))}
              {proposal.tags.map((tag) => (
                <span key={tag} style={{ ...chip, opacity: 0.75 }}>{tag}</span>
              ))}
            </div>

            {proposal.palette.length > 0 && (
              <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--uwe-muted)" }}>Palette:</span>
                {proposal.palette.map((color) => (
                  <span
                    key={color}
                    title={color}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: "1px solid var(--uwe-border)",
                      background: color,
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
            )}

            {proposal.outputType === "json-recipe" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={sectionLabel}>Rezept-Preview (deterministisch gezeichnet, kein Code)</span>
                <RtxAssetRecipePreview recipe={proposal.recipe} size={160} />
              </div>
            )}

            <pre
              style={{
                background: "var(--uwe-surface)",
                border: "1px solid var(--uwe-border)",
                borderRadius: 4,
                padding: "0.75rem",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 280,
                overflowY: "auto",
                margin: 0,
              }}
            >
              {proposalJson}
            </pre>
            <p style={{ margin: 0, fontSize: 11, color: "var(--uwe-muted)" }}>
              Speichern legt nur ein Pending-Palette-Item an — kein Kartenobjekt, keine
              Builtin-Übernahme. Sichtbar wird es erst nach Genehmigung.
            </p>
          </div>
        )}

        {/* Save feedback */}
        {saveError && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-danger)" }}>{saveError}</p>
        )}
        {saveSuccess && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-success, #16a34a)" }}>
            {saveSuccess}
          </p>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={onClose}>
            Schließen
          </button>
          {proposal && !saveSuccess && (
            <>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={resetResult}
                disabled={isSaving}
                title="Proposal verwerfen — nichts wird gespeichert"
              >
                Verwerfen
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Speichere…" : "Als Pending-Asset speichern"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
