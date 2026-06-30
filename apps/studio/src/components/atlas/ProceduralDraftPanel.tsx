"use client";

/**
 * ProceduralDraftPanel — P4 Atlas procedural draft + AI naming.
 *
 * Opens as a modal dialog with three stages:
 *   1. Prompt: text hint + seed → calls generateAtlasDraftAction
 *   2. Preview: mini SVG overview of draft features + reroll with lock checkboxes
 *   3. Apply: converts DraftFeature[] → EditorFeature[] and calls onApply
 *
 * "Namen generieren" calls /api/brain/run with atlas_name_regions action,
 * shows returned proposals inline, and lets the user pick names for features
 * before applying them — never auto-applies.
 */

import { useCallback, useState, useTransition } from "react";
import type { AtlasDraft, DraftFeature } from "@uwe/atlas/procedural";
import { generateAtlasDraftAction } from "@/app/atlas-actions";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import type { EditorFeature } from "./AtlasEditor";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a DraftFeature to an EditorFeature for use in the Atlas editor. */
function draftToEditorFeature(draft: DraftFeature): EditorFeature {
  type GeoUnion = EditorFeature["geometry"];

  let geo: GeoUnion;
  const g = draft.geometry;

  if (g.type === "Polygon") {
    geo = { type: "Polygon", rings: g.rings as [number, number][][] };
  } else if (g.type === "Path") {
    geo = { type: "Path", coordinates: g.coordinates as [number, number][] };
  } else if (g.type === "Point") {
    geo = { type: "Point", coordinates: g.coordinates as [number, number] };
  } else {
    // Fallback: should not occur
    geo = { type: "Point", coordinates: [0.5, 0.5] };
  }

  const kindMap: Record<string, EditorFeature["kind"]> = {
    coastline: "region",
    region: "region",
    mountain: "relief",
    forest: "biome",
    river: "river",
    city: "pin",
  };
  const kind = kindMap[draft.kind] ?? "region";

  const layerMap: Record<string, number> = {
    coastline: 10,
    region: 10,
    mountain: 20,
    forest: 10,
    river: 30,
    city: 50,
  };

  const style =
    draft.kind === "forest"
      ? { biomeKind: draft.biome ?? "forest", density: 1.0 }
      : draft.kind === "mountain"
        ? { biomeKind: draft.biome ?? "mountains", density: 0.8 }
        : undefined;

  return {
    _key: `proc-${draft.id}`,
    kind,
    geometry: geo,
    style: style as EditorFeature["style"],
    labelText: draft.labelHint || null,
    layer: layerMap[draft.kind] ?? 10,
    sortOrder: 0,
    visibility: "dm_only",
  };
}

// ---------------------------------------------------------------------------
// SVG mini-preview
// ---------------------------------------------------------------------------

const SVG_SIZE = 280;

function DraftPreviewSvg({
  draft,
  lockedIds,
  onToggleLock,
}: {
  draft: AtlasDraft;
  lockedIds: Set<string>;
  onToggleLock: (id: string) => void;
}) {
  const bx = draft.bounds.minX;
  const by = draft.bounds.minY;
  const bw = draft.bounds.maxX - bx;
  const bh = draft.bounds.maxY - by;

  function toSvg(nx: number, ny: number): [number, number] {
    return [((nx - bx) / bw) * SVG_SIZE, ((ny - by) / bh) * SVG_SIZE];
  }

  const kindColors: Record<string, string> = {
    coastline: "#c8e0e8",
    region: "#e2d9cc",
    mountain: "#7a6b52",
    forest: "rgba(74,103,65,0.55)",
    river: "#6baed6",
    city: "#2c1810",
  };

  const elements: React.ReactNode[] = [];

  for (const feat of draft.features) {
    const color = kindColors[feat.kind] ?? "#888";
    const isLocked = lockedIds.has(feat.id);
    const g = feat.geometry;
    const strokeExtra = isLocked ? " 2" : "";

    if (g.type === "Polygon" && g.rings[0]) {
      const ring = g.rings[0];
      const pts = ring.map(([x, y]) => toSvg(x!, y!).join(",")).join(" ");
      elements.push(
        <polygon
          key={feat.id}
          points={pts}
          fill={color}
          fillOpacity={feat.kind === "coastline" ? 0.4 : 0.35}
          stroke={isLocked ? "#2563eb" : color}
          strokeWidth={isLocked ? 2 : 1}
          strokeDasharray={isLocked ? "4,2" : undefined}
          style={{ cursor: "pointer" }}
          onClick={() => onToggleLock(feat.id)}
        />,
      );
    } else if (g.type === "Path" && g.coordinates.length > 1) {
      const pts = g.coordinates.map(([x, y]) => toSvg(x!, y!).join(",")).join(" ");
      elements.push(
        <polyline
          key={feat.id}
          points={pts}
          fill="none"
          stroke={isLocked ? "#2563eb" : color}
          strokeWidth={feat.kind === "river" ? 1.5 : 1 + (isLocked ? 1 : 0)}
          strokeDasharray={isLocked ? "4,2" : undefined}
          style={{ cursor: "pointer" }}
          onClick={() => onToggleLock(feat.id)}
        />,
      );
    } else if (g.type === "Point") {
      const [sx, sy] = toSvg(g.coordinates[0]!, g.coordinates[1]!);
      elements.push(
        <circle
          key={feat.id}
          cx={sx}
          cy={sy}
          r={isLocked ? 5 : 3.5}
          fill={isLocked ? "#2563eb" : color}
          stroke="#fff"
          strokeWidth={0.5}
          style={{ cursor: "pointer" }}
          onClick={() => onToggleLock(feat.id)}
        />,
      );
    }
    void strokeExtra;
  }

  return (
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{
        border: "1px solid var(--uwe-border)",
        borderRadius: 4,
        background: "#f5f0e8",
      }}
    >
      {elements}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Name proposal parsing
// ---------------------------------------------------------------------------

interface ParsedNameProposal {
  featureId: string;
  primary: string;
  alt?: string;
}

/**
 * Parse AI result text of the form:
 *   draft-seed-kind-0: Nordfjord (Eisfjord)
 *   draft-seed-kind-1: Nebelwald
 */
function parseNameProposals(
  text: string,
  features: DraftFeature[],
): ParsedNameProposal[] {
  const results: ParsedNameProposal[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const rawId = match[1]!.trim();
    const nameRaw = match[2]!.trim();
    const feat = features.find((f) => f.id === rawId || f.labelHint === rawId);
    if (!feat) continue;
    const altMatch = nameRaw.match(/^(.+?)\s*\((.+?)\)$/);
    results.push({
      featureId: feat.id,
      primary: altMatch ? altMatch[1]!.trim() : nameRaw,
      alt: altMatch ? altMatch[2]!.trim() : undefined,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// ProceduralDraftPanel component
// ---------------------------------------------------------------------------

export interface ProceduralDraftPanelProps {
  worldSlug: string;
  nodeId: string;
  onApply: (features: EditorFeature[]) => void;
  onClose: () => void;
}

type PanelStep = "prompt" | "preview" | "names";

export function ProceduralDraftPanel({
  worldSlug,
  onApply,
  onClose,
}: ProceduralDraftPanelProps) {
  const [step, setStep] = useState<PanelStep>("prompt");
  const [promptText, setPromptText] = useState("");
  const [seedText, setSeedText] = useState(() => String(Math.floor(Math.random() * 99999) + 1000));
  const [regionCount, setRegionCount] = useState(3);
  const [riverCount, setRiverCount] = useState(2);
  const [cityCount, setCityCount] = useState(3);

  const [draft, setDraft] = useState<AtlasDraft | null>(null);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // Names step
  const [nameProvider, setNameProvider] = useState("ollama");
  const [nameModel, setNameModel] = useState("gemma3:4b");
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameProposals, setNameProposals] = useState<ParsedNameProposal[]>([]);
  const [acceptedNames, setAcceptedNames] = useState<Record<string, string>>({});
  const [isNaming, setIsNaming] = useState(false);

  const handleGenerate = useCallback(() => {
    setGenerateError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("seed", seedText.trim() || String(Math.floor(Math.random() * 99999)));
      fd.set(
        "hints",
        JSON.stringify({ regionCount, riverCount, cityCount, nameHint: promptText.trim() || undefined }),
      );
      const result = await generateAtlasDraftAction(fd);
      if ("error" in result && result.error) {
        setGenerateError(result.error);
      } else if ("draft" in result && result.draft) {
        setDraft(result.draft);
        setLockedIds(new Set());
        setNameProposals([]);
        setAcceptedNames({});
        setStep("preview");
      }
    });
  }, [worldSlug, seedText, promptText, regionCount, riverCount, cityCount]);

  const handleReroll = useCallback(() => {
    if (!draft) return;
    setGenerateError(null);
    const newSeed = String(Math.floor(Math.random() * 99999) + 1000);
    setSeedText(newSeed);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("worldSlug", worldSlug);
      fd.set("seed", newSeed);
      fd.set("prevDraft", JSON.stringify(draft));
      fd.set("lockedIds", JSON.stringify([...lockedIds]));
      const result = await generateAtlasDraftAction(fd);
      if ("error" in result && result.error) {
        setGenerateError(result.error);
      } else if ("draft" in result && result.draft) {
        setDraft(result.draft);
        setNameProposals([]);
        setAcceptedNames({});
      }
    });
  }, [draft, lockedIds, worldSlug]);

  const toggleLock = useCallback((id: string) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!draft) return;
    const editorFeatures = draft.features.map((feat) => {
      const ef = draftToEditorFeature(feat);
      // Apply accepted names as labelText
      const acceptedName = acceptedNames[feat.id];
      if (acceptedName) {
        ef.labelText = acceptedName;
      }
      return ef;
    });
    onApply(editorFeatures);
    onClose();
  }, [draft, acceptedNames, onApply, onClose]);

  const handleGenerateNames = useCallback(async () => {
    if (!draft || !worldSlug) return;
    setIsNaming(true);
    setNameStatus(null);
    setNameProposals([]);

    // Build userPrompt with feature list
    const featureList = draft.features
      .filter((f) => f.kind !== "coastline")
      .map((f) => `${f.id}: ${f.labelHint} (${f.kind})`)
      .join("\n");

    const userPromptText = [
      promptText ? `Weltthema: ${promptText}` : "",
      "",
      "Zu benennende Elemente (ID: Bezeichnung (Typ)):",
      featureList,
      "",
      "Antworte im Format 'ID: Name (Alternativname)' — eine Zeile pro Element.",
    ]
      .filter((l, i) => i > 0 || l)
      .join("\n");

    try {
      const response = await fetch(studioApiUrl("/api/brain/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: "atlas_name_regions",
          worldSlug,
          providerId: nameProvider,
          model: nameModel,
          userPrompt: userPromptText,
          allowDmOnly: true,
          useMock: nameModel === "mock-model" || process.env.NEXT_PUBLIC_AI_USE_MOCK === "true",
          sync: true,
        }),
      });
      const data = await response.json() as {
        run?: { resultText?: string | null };
        proposals?: Array<{ content: string }>;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Benennungs-Aktion fehlgeschlagen");
      }
      const resultText = data.run?.resultText ?? data.proposals?.[0]?.content ?? "";
      const parsed = parseNameProposals(resultText, draft.features);
      setNameProposals(parsed);
      // Pre-accept all primary names
      const initial: Record<string, string> = {};
      for (const p of parsed) {
        initial[p.featureId] = p.primary;
      }
      setAcceptedNames(initial);
      setStep("names");
      setNameStatus(parsed.length > 0 ? `${parsed.length} Namen vorgeschlagen.` : "Keine Namen erkannt — bitte manuell benennen.");
    } catch (err) {
      setNameStatus(err instanceof Error ? err.message : "Benennungs-Fehler");
    } finally {
      setIsNaming(false);
    }
  }, [draft, worldSlug, promptText, nameProvider, nameModel]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const featureLabel = (f: DraftFeature) => {
    const kindLabels: Record<string, string> = {
      coastline: "Küste",
      region: "Region",
      mountain: "Gebirge",
      forest: "Wald",
      river: "Fluss",
      city: "Ort",
    };
    return `${kindLabels[f.kind] ?? f.kind}: ${f.labelHint || f.id}`;
  };

  // ---------------------------------------------------------------------------
  // Modal layout
  // ---------------------------------------------------------------------------

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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--uwe-bg)",
          border: "1px solid var(--uwe-border)",
          borderRadius: "var(--uwe-radius)",
          padding: "1.5rem",
          minWidth: 380,
          maxWidth: 700,
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
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {step === "prompt" && "Entwurf generieren"}
            {step === "preview" && "Entwurf — Vorschau & Würfeln"}
            {step === "names" && "Namen-Vorschläge prüfen"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--uwe-muted)" }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {/* ---- STEP: PROMPT ---- */}
        {step === "prompt" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
              Thema / Beschreibung (optional)
              <input
                className="uwe-input"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="z.B. Nordisches Küstenreich mit Fjorden"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
              Seed (Zahl oder Text)
              <input
                className="uwe-input"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder="z.B. 42 oder 'Eisfjord'"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 12 }}>
                Regionen
                <input
                  type="number"
                  className="uwe-input"
                  min={1} max={8}
                  value={regionCount}
                  onChange={(e) => setRegionCount(Number(e.target.value))}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 12 }}>
                Flüsse
                <input
                  type="number"
                  className="uwe-input"
                  min={0} max={5}
                  value={riverCount}
                  onChange={(e) => setRiverCount(Number(e.target.value))}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 12 }}>
                Orte
                <input
                  type="number"
                  className="uwe-input"
                  min={0} max={8}
                  value={cityCount}
                  onChange={(e) => setCityCount(Number(e.target.value))}
                />
              </label>
            </div>

            {generateError && (
              <p style={{ color: "var(--uwe-danger)", fontSize: 13, margin: 0 }}>{generateError}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={onClose}>
                Abbrechen
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                onClick={handleGenerate}
                disabled={isPending}
              >
                {isPending ? "Generiere…" : "Entwurf generieren"}
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP: PREVIEW ---- */}
        {step === "preview" && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-muted)" }}>
              Seed: <strong>{draft.seed}</strong> · {draft.features.length} Elemente ·{" "}
              <span style={{ color: "#2563eb" }}>Blaue Elemente</span> = gesperrt (Klick zum Sperren/Entsperren)
            </p>

            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <DraftPreviewSvg draft={draft} lockedIds={lockedIds} onToggleLock={toggleLock} />

              {/* Feature list with lock checkboxes */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 12 }}>
                <strong style={{ fontSize: 13 }}>Elemente</strong>
                <div style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: 4,
                  padding: "0.4rem",
                }}>
                  {draft.features.map((feat) => (
                    <label
                      key={feat.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.2rem 0",
                        cursor: "pointer",
                        color: lockedIds.has(feat.id) ? "#2563eb" : undefined,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={lockedIds.has(feat.id)}
                        onChange={() => toggleLock(feat.id)}
                      />
                      {featureLabel(feat)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {generateError && (
              <p style={{ color: "var(--uwe-danger)", fontSize: 13, margin: 0 }}>{generateError}</p>
            )}

            {/* Naming config (compact) */}
            <details style={{ fontSize: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--uwe-muted)" }}>
                KI-Namen konfigurieren
              </summary>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  Provider
                  <select
                    className="uwe-input"
                    value={nameProvider}
                    onChange={(e) => setNameProvider(e.target.value)}
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
                    value={nameModel}
                    onChange={(e) => setNameModel(e.target.value)}
                    placeholder="z.B. gemma3:4b"
                    style={{ fontSize: 12, width: 160 }}
                  />
                </label>
              </div>
            </details>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={handleReroll}
                disabled={isPending}
                title="Neue Variante mit demselben Seed-Bereich, sperrt ausgewählte Elemente"
              >
                {isPending ? "Würfle…" : "🎲 Neu würfeln"}
              </button>

              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={() => void handleGenerateNames()}
                disabled={isNaming || !nameModel.trim()}
                title="Schlägt stimmungsvolle Namen vor — nie automatisch angewendet"
              >
                {isNaming ? "Benenne…" : "✨ Namen generieren"}
              </button>

              {nameStatus && (
                <span style={{ fontSize: 12, color: "var(--uwe-muted)", alignSelf: "center" }}>
                  {nameStatus}
                </span>
              )}

              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() => setStep("prompt")}
              >
                ← Zurück
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                onClick={handleApply}
              >
                Entwurf anwenden
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP: NAMES ---- */}
        {step === "names" && draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--uwe-muted)" }}>
              KI-Namensvorschläge — wähle die gewünschten Namen aus. Nicht übernommene Vorschläge werden verworfen.
            </p>

            {nameProposals.length === 0 ? (
              <p style={{ color: "var(--uwe-muted)", fontSize: 13 }}>Keine Namensvorschläge verfügbar.</p>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                maxHeight: 320,
                overflowY: "auto",
                border: "1px solid var(--uwe-border)",
                borderRadius: 4,
                padding: "0.5rem",
              }}>
                {nameProposals.map((np) => {
                  const feat = draft.features.find((f) => f.id === np.featureId);
                  return (
                    <div key={np.featureId} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: 13 }}>
                      <span style={{ minWidth: 130, color: "var(--uwe-muted)" }}>
                        {feat ? featureLabel(feat) : np.featureId}:
                      </span>
                      <input
                        className="uwe-input"
                        value={acceptedNames[np.featureId] ?? np.primary}
                        onChange={(e) => setAcceptedNames((prev) => ({ ...prev, [np.featureId]: e.target.value }))}
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      {np.alt && (
                        <button
                          type="button"
                          className="uwe-v2-btn uwe-v2-btn-secondary"
                          style={{ fontSize: 11, padding: "0.1rem 0.4rem" }}
                          onClick={() => setAcceptedNames((prev) => ({ ...prev, [np.featureId]: np.alt! }))}
                          title="Alternativname verwenden"
                        >
                          ↔ {np.alt}
                        </button>
                      )}
                      <button
                        type="button"
                        className="uwe-v2-btn uwe-v2-btn-secondary"
                        style={{ fontSize: 11, padding: "0.1rem 0.4rem" }}
                        onClick={() => setAcceptedNames((prev) => {
                          const next = { ...prev };
                          delete next[np.featureId];
                          return next;
                        })}
                        title="Keinen Namen verwenden"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={() => setStep("preview")}
              >
                ← Vorschau
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                onClick={handleApply}
              >
                Entwurf + Namen anwenden
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
