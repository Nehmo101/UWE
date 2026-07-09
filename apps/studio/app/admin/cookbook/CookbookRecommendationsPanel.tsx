"use client";

import { useMemo, useState } from "react";
import type { CookbookRecommendation, CookbookUseCaseId } from "@uwe/cookbook";

const CATEGORY_OPTIONS: Array<{ id: "all" | CookbookUseCaseId; label: string }> = [
  { id: "all", label: "Alle Bereiche" },
  { id: "dnd_generator", label: "DnD-Generator" },
  { id: "deep_research", label: "Deep Research" },
  { id: "editor_rewrite", label: "Editor / Lore" },
  { id: "image_prompting", label: "Image Prompting" },
  { id: "session_prep", label: "Session Prep" },
  { id: "canon_check", label: "Kanon-Check" },
  { id: "player_safe_rewrite", label: "Player-safe" },
];

interface Props {
  recommendations: CookbookRecommendation[];
}

function fitLevelLabel(level: string): string {
  switch (level) {
    case "excellent":
      return "Ausgezeichnet";
    case "good":
      return "Gut";
    case "marginal":
      return "Grenzwertig";
    case "poor":
      return "Schwach";
    default:
      return "Nicht geeignet";
  }
}

export function CookbookRecommendationsPanel({ recommendations }: Props) {
  const [category, setCategory] = useState<"all" | CookbookUseCaseId>("all");

  const filtered = useMemo(
    () =>
      category === "all"
        ? recommendations
        : recommendations.filter((rec) => rec.useCase === category),
    [category, recommendations],
  );

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <h2 className="uwe-v2-section-title">Empfehlungen pro Use Case</h2>
        <label>
          Kategorie
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="uwe-dashboard-grid">
        {filtered.map((rec) => (
          <article key={rec.useCase} className="uwe-v2-card uwe-dashboard-card">
            <h3 className="uwe-v2-section-title" style={{ fontSize: "1rem" }}>
              {rec.label}
            </h3>
            <p className="uwe-dashboard-muted">{rec.description}</p>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(7rem, auto) 1fr",
                gap: "0.25rem 0.75rem",
                fontSize: "0.85rem",
                marginTop: "0.5rem",
              }}
            >
              <dt className="uwe-dashboard-muted">Modell</dt>
              <dd style={{ margin: 0 }}>{rec.modelLabel}</dd>
              <dt className="uwe-dashboard-muted">Engine</dt>
              <dd style={{ margin: 0 }}>{rec.engineId}</dd>
              <dt className="uwe-dashboard-muted">Hardware-Fit</dt>
              <dd style={{ margin: 0 }}>
                {rec.fit.score}/100 — {fitLevelLabel(rec.fit.level)}
              </dd>
            </dl>
            <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              {rec.privacyNote}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
