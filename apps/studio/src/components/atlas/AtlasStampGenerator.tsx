"use client";

/**
 * AtlasStampGenerator — P5 KI-Stempel-Generierung.
 *
 * Opens as a modal dialog:
 *   1. Keyword input → "Generieren" calls generateAtlasStampVariantsAction
 *   2. Preview: shows 5 generated stamp thumbnails with multi-select
 *   3. Reload button for a fresh batch (keeps keyword)
 *   4. "Speichern" saves selected variants as AtlasPaletteItem (pending)
 *
 * Generated images require RTX or Cloud per gateway policy.
 * contextMode is always "prompt_only" — no world/brain context.
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  generateAtlasStampVariantsAction,
  saveAtlasStampVariantsAction,
} from "@/app/atlas-actions";
import type { StampVariantResult } from "@/app/atlas-actions";
import { Alert, Button, cn, Input, Label, NavIcon } from "@/src/components/ui";

export interface AtlasStampGeneratorProps {
  worldSlug: string;
  nodeId: string;
  onClose: () => void;
  /** Called after variants are saved so the editor can refresh. */
  onSaved: () => void;
}

export function AtlasStampGenerator({
  worldSlug,
  nodeId,
  onClose,
  onSaved,
}: AtlasStampGeneratorProps) {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [variants, setVariants] = useState<StampVariantResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [isGenerating, startGenerateTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(() => {
    if (!keyword.trim()) return;
    setGenerateError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setVariants([]);
    setSelectedIndices(new Set());

    startGenerateTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("keyword", keyword.trim());
      const result = await generateAtlasStampVariantsAction(fd);
      if ("error" in result && result.error) {
        setGenerateError(result.error);
      } else if ("variants" in result && result.variants) {
        setVariants(result.variants);
        // Pre-select all by default
        setSelectedIndices(new Set(result.variants.map((_, i) => i)));
      }
    });
  }, [worldSlug, keyword]);

  const handleReload = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  // ---------------------------------------------------------------------------
  // Toggle selection
  // ---------------------------------------------------------------------------

  const toggleSelect = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(() => {
    if (!selectedIndices.size) return;
    setSaveError(null);
    setSaveSuccess(null);

    const selected = variants.filter((_, i) => selectedIndices.has(i));

    startSaveTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("nodeId", nodeId);
      fd.set("keyword", keyword.trim());
      fd.set(
        "variants",
        JSON.stringify(
          selected.map((v) => ({
            imageBase64: v.imageBase64,
            mimeType: v.mimeType,
            prompt: v.prompt,
          })),
        ),
      );

      const result = await saveAtlasStampVariantsAction(fd);
      if ("error" in result && result.error) {
        setSaveError(result.error);
      } else if ("savedIds" in result && result.savedIds) {
        setSaveSuccess(
          `${result.savedIds.length} Stempel gespeichert (ausstehende Genehmigung).`,
        );
        onSaved();
        router.refresh();
      }
    });
  }, [worldSlug, nodeId, keyword, variants, selectedIndices, onSaved, router]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasVariants = variants.length > 0;
  const selectedCount = selectedIndices.size;

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
          <h2 className="m-0 text-lg font-semibold">KI-Stempel generieren</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
            <NavIcon name="x" width={18} height={18} />
          </Button>
        </div>

        {/* Keyword input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="stamp-keyword" className="text-sm font-normal text-muted-foreground">
            Stichwort (z.B. &quot;Kirche&quot;, &quot;Hafen&quot;, &quot;Drachenhöhle&quot;)
          </Label>
          <div className="flex gap-2">
            <Input
              id="stamp-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyword.trim()) handleGenerate();
              }}
              placeholder="z.B. Kirche"
              className="flex-1"
              autoFocus
            />
            <Button type="button" onClick={handleGenerate} disabled={isGenerating || !keyword.trim()}>
              {isGenerating ? "Generiere…" : "Generieren"}
            </Button>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            Gouache-Malstil (deckend, Pigmentkante) · transparent · Karten-Stempel-Stil
          </p>
        </div>

        {/* Error */}
        {generateError && (
          <Alert tone="danger" role="alert">
            {generateError}
          </Alert>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="flex aspect-square animate-pulse items-center justify-center rounded border border-border bg-muted text-xs text-muted-foreground"
              >
                <NavIcon name="sparkles" width={14} height={14} />
              </div>
            ))}
          </div>
        )}

        {/* Variants grid */}
        {hasVariants && !isGenerating && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {variants.length} Varianten · Klicken zum Auswählen
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleReload}
                disabled={isGenerating}
                title="Neue Varianten mit demselben Stichwort generieren"
              >
                <NavIcon name="rotate-cw" width={14} height={14} />
                Neu generieren
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {variants.map((v, idx) => {
                const isSelected = selectedIndices.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    title={isSelected ? "Abwählen" : "Auswählen"}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-sm border-2 bg-muted p-0",
                      isSelected ? "border-primary" : "border-border",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${v.mimeType};base64,${v.imageBase64}`}
                      alt={`${keyword} Variante ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="block h-full w-full object-contain"
                    />
                    {isSelected && (
                      <div className="absolute right-1 top-1 flex size-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <NavIcon name="check" width={12} height={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="m-0 text-xs text-muted-foreground">
              Provider: {variants[0]?.providerUsed ?? "–"} · Prompt: {variants[0]?.prompt.slice(0, 80)}…
            </p>
          </div>
        )}

        {/* Save feedback */}
        {saveError && <p className="m-0 text-sm text-destructive">{saveError}</p>}
        {saveSuccess && <p className="m-0 text-sm text-success">{saveSuccess}</p>}

        {/* Footer actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
          {hasVariants && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || selectedCount === 0}
              title={
                selectedCount === 0
                  ? "Mindestens eine Variante auswählen"
                  : `${selectedCount} Stempel in Palette speichern (ausstehende Genehmigung)`
              }
            >
              {isSaving
                ? "Speichere…"
                : `${selectedCount > 0 ? selectedCount : ""} Stempel speichern`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
