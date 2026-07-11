"use client";

import { useMemo, useState } from "react";
import type { CookbookRecommendation, CookbookUseCaseId } from "@uwe/cookbook";
import { Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — controlled Kategorie-Filter mit festem Default ("all"). */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
        <CardTitle>Empfehlungen pro Use Case</CardTitle>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cookbook-category">Kategorie</Label>
          <select
            id="cookbook-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            className={NATIVE_SELECT_CLASS}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((rec) => (
            <Card key={rec.useCase}>
              <CardHeader>
                <CardTitle className="text-base">{rec.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{rec.description}</p>
                <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Modell</dt>
                  <dd>{rec.modelLabel}</dd>
                  <dt className="text-muted-foreground">Engine</dt>
                  <dd>{rec.engineId}</dd>
                  <dt className="text-muted-foreground">Hardware-Fit</dt>
                  <dd>
                    {rec.fit.score}/100 — {fitLevelLabel(rec.fit.level)}
                  </dd>
                </dl>
                <p className="text-xs text-muted-foreground">{rec.privacyNote}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
