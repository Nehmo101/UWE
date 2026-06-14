"use client";

import { useCallback, useEffect, useState } from "react";
import { AiBrainSidebar } from "./AiBrainSidebar";
import type { DndGeneratorView } from "@uwe/ai-brain";

export type AiContextKind = "page" | "session" | "dungeon_room";

interface Props {
  kind: AiContextKind;
  worldSlug: string;
  pageSlug?: string;
  sessionId?: string;
  dungeonSlug?: string;
  levelSlug?: string;
  roomSlug?: string;
}

export function AiContextPanel({
  kind,
  worldSlug,
  pageSlug,
  sessionId,
  dungeonSlug,
  levelSlug,
  roomSlug,
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

    const response = await fetch(`/api/dnd-generator?${params.toString()}`);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setLoadError(data.error ?? "Generator-Kontext konnte nicht geladen werden.");
      return;
    }

    const data = (await response.json()) as { generator: DndGeneratorView };
    setGenerator(data.generator);
    setLoadError(null);
  }, [kind, worldSlug, pageSlug, sessionId, dungeonSlug, levelSlug, roomSlug]);

  useEffect(() => {
    void loadGenerator();
  }, [loadGenerator]);

  return (
    <div className="uwe-ai-context-panel">
      {loadError && <p className="uwe-notice uwe-notice-warn">{loadError}</p>}

      {generator && (
        <>
          <section style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Kontext: {generator.context.title ?? generator.context.kind}
            </h3>
            {generator.missingContent.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <strong style={{ fontSize: "0.8rem" }}>Fehlt noch:</strong>
                <ul style={{ fontSize: "0.8rem", paddingLeft: "1.25rem", marginTop: "0.25rem" }}>
                  {generator.missingContent.map((hint) => (
                    <li key={hint.field}>
                      {hint.label}
                      <span className="uwe-hint"> → {hint.suggestedActionId}</span>
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
              <p className="uwe-hint" style={{ marginTop: "0.5rem" }}>
                {generator.actions.length} kontextuelle KI-Aktionen verfügbar — Ergebnisse immer als
                Review-Proposal.
              </p>
            )}
          </section>
        </>
      )}

      {(pageSlug || sessionId) && (
        <AiBrainSidebar
          worldSlug={worldSlug}
          pageSlug={pageSlug}
          sessionId={sessionId}
          defaultSessionId={sessionId}
          generatorActions={generator?.actions}
        />
      )}
    </div>
  );
}
