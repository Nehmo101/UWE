"use client";

import { AiBrainSidebar } from "./AiBrainSidebar";

interface Props {
  worldSlug: string;
  campaignId?: string;
}

export function BrainAiGeneratePanel({ worldSlug, campaignId: _campaignId }: Props) {
  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section uwe-brain-ai-panel">
      <h2 className="uwe-v2-section-title">KI-Wissensgenerierung</h2>
      <p className="uwe-hint" style={{ marginTop: 0 }}>
        Brain-Aktionen für diese Welt — Ergebnisse immer als Review-Proposal übernehmen. Läuft über
        den RTX Connector (lokal), nicht über veraltete Ollama-Direktauswahl.
      </p>
      <AiBrainSidebar
        worldSlug={worldSlug}
        defaultActionId="expand_knowledge"
        variant="store"
      />
    </section>
  );
}
