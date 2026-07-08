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
          <h2 style={{ margin: 0, fontSize: 18 }}>KI-Stempel generieren</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--uwe-muted)",
            }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {/* Keyword input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label
            htmlFor="stamp-keyword"
            style={{ fontSize: 13, color: "var(--uwe-muted)" }}
          >
            Stichwort (z.B. &quot;Kirche&quot;, &quot;Hafen&quot;, &quot;Drachenhöhle&quot;)
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="stamp-keyword"
              className="uwe-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keyword.trim()) handleGenerate();
              }}
              placeholder="z.B. Kirche"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              onClick={handleGenerate}
              disabled={isGenerating || !keyword.trim()}
            >
              {isGenerating ? "Generiere…" : "Generieren"}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--uwe-muted)" }}>
            Gouache-Malstil (deckend, Pigmentkante) · transparent · Karten-Stempel-Stil
          </p>
        </div>

        {/* Error */}
        {generateError && (
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
            {generateError}
          </p>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "0.5rem",
            }}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  background: "var(--uwe-surface)",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--uwe-muted)",
                  fontSize: 11,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              >
                ✦
              </div>
            ))}
          </div>
        )}

        {/* Variants grid */}
        {hasVariants && !isGenerating && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--uwe-muted)" }}>
                {variants.length} Varianten · Klicken zum Auswählen
              </span>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={handleReload}
                disabled={isGenerating}
                title="Neue Varianten mit demselben Stichwort generieren"
                style={{ fontSize: 12 }}
              >
                ↻ Neu generieren
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.5rem",
              }}
            >
              {variants.map((v, idx) => {
                const isSelected = selectedIndices.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    title={isSelected ? "Abwählen" : "Auswählen"}
                    aria-pressed={isSelected}
                    style={{
                      padding: 0,
                      border: isSelected
                        ? "2px solid var(--uwe-accent)"
                        : "2px solid var(--uwe-border)",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: "var(--uwe-surface)",
                      position: "relative",
                      overflow: "hidden",
                      aspectRatio: "1",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${v.mimeType};base64,${v.imageBase64}`}
                      alt={`${keyword} Variante ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "var(--uwe-accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#fff",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <p style={{ margin: 0, fontSize: 11, color: "var(--uwe-muted)" }}>
              Provider: {variants[0]?.providerUsed ?? "–"} · Prompt: {variants[0]?.prompt.slice(0, 80)}…
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

        {/* Footer actions */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={onClose}
          >
            Schließen
          </button>
          {hasVariants && (
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
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
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
