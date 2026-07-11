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
import { Alert, Button, Input, Label, NavIcon, Textarea, cn } from "@/src/components/ui";

export interface AtlasAssetProposalStudioProps {
  worldSlug: string;
  onClose: () => void;
  /** Prefill the prompt (e.g. from an editor "Asset fehlt?" wish). */
  initialPrompt?: string;
}

const MAX_PROMPT_LENGTH = 500;

const SECTION_LABEL_CLASS = "text-[13px] text-muted-foreground";

const CHIP_CLASS =
  "inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]";

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
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] min-w-[min(480px,calc(100vw-2rem))] max-w-[min(760px,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-[var(--radius)] border border-border bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">RTX-Asset-Studio — Gouache-Asset vorschlagen</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
            <NavIcon name="x" className="size-[18px]" />
          </Button>
        </div>

        <p className="m-0 text-xs text-muted-foreground">
          Styleguide (<code>docs/prompts/atlas-pictogram-styleguide.md</code>) und Asset-Katalog
          werden serverseitig in den Prompt injiziert. Das Ergebnis ist ein validiertes
          Review-Proposal — nie Auto-Apply, kein Code.
        </p>

        {/* Prompt */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rtx-asset-prompt" className={SECTION_LABEL_CLASS}>
            Asset-Beschreibung (z.B. „verwunschener Leuchtturm auf Klippe, Landmarke“)
          </Label>
          <Textarea
            id="rtx-asset-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
            rows={3}
            placeholder="Beschreibe das gewünschte Gouache-Asset…"
            autoFocus
            className="resize-y"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Gouache-Stil · gedämpfte Kartenpalette · Base-centre-Anker</span>
            <span>{prompt.length}/{MAX_PROMPT_LENGTH}</span>
          </div>
        </div>

        {/* Provider config — local/RTX only */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            KI konfigurieren (nur lokal/RTX)
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rtx-asset-provider" className="text-xs">
                Provider
              </Label>
              {/* TODO(design-kit): natives select bleibt — controlled Provider-Wahl, konsistent mit
                  gleichem Muster in DesignAssistantWizard.tsx. */}
              <select
                id="rtx-asset-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ollama">Ollama (lokal)</option>
                <option value="openai_compatible">OpenAI-kompatibel (lokal/RTX)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="rtx-asset-model" className="text-xs">
                Modell
              </Label>
              <Input
                id="rtx-asset-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="z.B. gemma3:4b"
                className="w-40 text-xs"
              />
            </div>
          </div>
        </details>

        {/* Generate */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1"
          >
            <NavIcon name="sparkles" className="size-4" />
            {isGenerating ? "Generiere Proposal…" : "Asset-Proposal generieren"}
          </Button>
        </div>

        {/* Validation failure: error + issues + raw output */}
        {generateError && (
          <div className="flex flex-col gap-1.5">
            <Alert tone="danger" role="alert" className="text-[13px]">
              {generateError}
            </Alert>
            {issues.length > 0 && (
              <ul className="m-0 list-none space-y-0.5 pl-0 text-xs text-destructive">
                {issues.map((issue, index) => (
                  <li key={index}>
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {rawText && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Rohausgabe anzeigen (verworfen)
                </summary>
                <pre className="mt-1.5 max-h-[180px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-2 text-[11px]">
                  {rawText}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Validated proposal preview */}
        {proposal && proposalJson && (
          <div className="flex flex-col gap-2.5">
            <p className="m-0 flex items-center gap-1.5 text-[13px] text-success">
              <NavIcon name="check" className="size-4" />
              Serverseitig validiert ({proposal.outputType})
              {providerUsed ? ` · Provider: ${providerUsed}` : ""}
            </p>
            {warnings.length > 0 && (
              <ul className="m-0 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="text-sm">{proposal.name}</strong>
              <span className={CHIP_CLASS}>{proposal.category}</span>
              {proposal.engineTags.map((tag) => (
                <span key={tag} className={CHIP_CLASS}>{tag}</span>
              ))}
              {proposal.tags.map((tag) => (
                <span key={tag} className={cn(CHIP_CLASS, "opacity-75")}>{tag}</span>
              ))}
            </div>

            {proposal.palette.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Palette:</span>
                {proposal.palette.map((color) => (
                  <span
                    key={color}
                    title={color}
                    className="inline-block size-[18px] rounded border border-border"
                    style={{ background: color }}
                  />
                ))}
              </div>
            )}

            {proposal.outputType === "json-recipe" && (
              <div className="flex flex-col gap-1">
                <span className={SECTION_LABEL_CLASS}>Rezept-Preview (deterministisch gezeichnet, kein Code)</span>
                <RtxAssetRecipePreview recipe={proposal.recipe} size={160} />
              </div>
            )}

            <pre className="m-0 max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-border bg-muted p-3 text-xs leading-relaxed">
              {proposalJson}
            </pre>
            <p className="m-0 text-[11px] text-muted-foreground">
              Speichern legt nur ein Pending-Palette-Item an — kein Kartenobjekt, keine
              Builtin-Übernahme. Sichtbar wird es erst nach Genehmigung.
            </p>
          </div>
        )}

        {/* Save feedback */}
        {saveError && <p className="m-0 text-[13px] text-destructive">{saveError}</p>}
        {saveSuccess && <p className="m-0 text-[13px] text-success">{saveSuccess}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
          {proposal && !saveSuccess && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={resetResult}
                disabled={isSaving}
                title="Proposal verwerfen — nichts wird gespeichert"
              >
                Verwerfen
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Speichere…" : "Als Pending-Asset speichern"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
