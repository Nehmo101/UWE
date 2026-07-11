"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { AiBrainSidebar } from "./AiBrainSidebar";
import type { DndGeneratorView } from "@uwe/ai-brain";

interface Props {
  worldSlug: string;
  pageType: string;
  campaignSlug?: string;
}

export function NewPageAiPanel({ worldSlug, pageType, campaignSlug: _campaignSlug }: Props) {
  const [generator, setGenerator] = useState<DndGeneratorView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGenerator = useCallback(async () => {
    const params = new URLSearchParams({
      worldSlug,
      kind: "draft",
      pageType,
    });

    const response = await fetch(studioApiUrl(`/api/dnd-generator?${params.toString()}`));
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setLoadError(data.error ?? "Generator-Kontext konnte nicht geladen werden.");
      return;
    }

    const data = (await response.json()) as { generator: DndGeneratorView };
    setGenerator(data.generator);
    setLoadError(null);
  }, [worldSlug, pageType]);

  useEffect(() => {
    void loadGenerator();
  }, [loadGenerator]);

  return (
    <section className="flex flex-col gap-2" style={{ marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>KI-Vorschläge</h2>
      <p className="text-sm text-muted-foreground" style={{ marginTop: 0 }}>
        KI-Vorschläge vor dem Anlegen — Ergebnisse als Review-Proposal.
      </p>

      {loadError && <p className="rounded-[var(--radius)] border border-warning/30 bg-warning/10 p-3 text-sm">{loadError}</p>}

      {generator && (
        <section style={{ marginBottom: "1rem" }}>
          <h3 className="text-sm text-muted-foreground" style={{ fontSize: "0.9rem" }}>
            Kontext: {generator.context.title ?? generator.context.kind}
          </h3>
          {generator.missingContent.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.8rem" }}>Fehlt noch:</strong>
              <ul style={{ fontSize: "0.8rem", paddingLeft: "1.25rem", marginTop: "0.25rem" }}>
                {generator.missingContent.map((hint) => (
                  <li key={hint.field}>
                    {hint.label}
                    <span className="text-sm text-muted-foreground"> → {hint.suggestedActionId}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {generator.canonConflicts.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.8rem" }}>Kanon-Hinweise:</strong>
              <ul style={{ fontSize: "0.8rem", paddingLeft: "1.25rem", marginTop: "0.25rem" }}>
                {generator.canonConflicts.map((conflict) => (
                  <li key={conflict.code}>{conflict.message}</li>
                ))}
              </ul>
            </div>
          )}
          {generator.actions.length > 0 && (
            <p className="text-sm text-muted-foreground" style={{ marginTop: "0.5rem" }}>
              {generator.actions.length} kontextuelle KI-Aktionen verfügbar.
            </p>
          )}
        </section>
      )}

      <AiBrainSidebar worldSlug={worldSlug} generatorActions={generator?.actions} />
    </section>
  );
}
