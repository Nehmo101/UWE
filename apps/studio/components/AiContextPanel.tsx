"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { AiBrainSidebar } from "./AiBrainSidebar";
import type { DndGeneratorView } from "@uwe/ai-brain";

export type AiContextKind = "page" | "session" | "dungeon_room" | "campaign";

interface Props {
  kind: AiContextKind;
  worldSlug: string;
  pageSlug?: string;
  sessionId?: string;
  dungeonSlug?: string;
  levelSlug?: string;
  roomSlug?: string;
  campaignSlug?: string;
}

export function AiContextPanel({
  kind,
  worldSlug,
  pageSlug,
  sessionId,
  dungeonSlug,
  levelSlug,
  roomSlug,
  campaignSlug,
}: Props) {
  const [generator, setGenerator] = useState<DndGeneratorView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGenerator = useCallback(async () => {
    const params = new URLSearchParams({ worldSlug, kind });
    if (pageSlug) params.set("pageSlug", pageSlug);
    if (sessionId) params.set("sessionId", sessionId);
    if (dungeonSlug) params.set("dungeonSlug", dungeonSlug);
    if (levelSlug) params.set("levelSlug", levelSlug);
    if (roomSlug) params.set("roomSlug", roomSlug);
    if (campaignSlug) params.set("campaignSlug", campaignSlug);

    const response = await fetch(studioApiUrl(`/api/dnd-generator?${params.toString()}`));
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setLoadError(data.error ?? "Generator-Kontext konnte nicht geladen werden.");
      return;
    }

    const data = (await response.json()) as { generator: DndGeneratorView };
    setGenerator(data.generator);
    setLoadError(null);
  }, [kind, worldSlug, pageSlug, sessionId, dungeonSlug, levelSlug, roomSlug, campaignSlug]);

  useEffect(() => {
    void loadGenerator();
  }, [loadGenerator]);

  return (
    <div className="flex flex-col gap-2">
      {loadError && <p className="rounded-[var(--radius)] border border-warning/30 bg-warning/10 p-3 text-sm">{loadError}</p>}

      {generator && (
        <>
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
                    <li key={conflict.code}>
                      {conflict.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {generator.actions.length > 0 && (
              <p className="text-sm text-muted-foreground" style={{ marginTop: "0.5rem" }}>
                {generator.actions.length} kontextuelle KI-Aktionen verfügbar — Ergebnisse immer als
                Review-Proposal.
              </p>
            )}
          </section>
        </>
      )}

      {(pageSlug || sessionId || campaignSlug) && (
        <AiBrainSidebar
          worldSlug={worldSlug}
          pageSlug={pageSlug}
          sessionId={sessionId}
          defaultSessionId={sessionId}
          campaignSlug={campaignSlug}
          defaultActionId={kind === "campaign" ? "campaign_chapter_draft" : undefined}
          generatorActions={generator?.actions}
        />
      )}
    </div>
  );
}
