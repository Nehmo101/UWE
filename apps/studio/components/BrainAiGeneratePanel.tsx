"use client";

import { AiBrainSidebar } from "./AiBrainSidebar";

interface Props {
  worldSlug: string;
  campaignId?: string;
}

export function BrainAiGeneratePanel({ worldSlug, campaignId: _campaignId }: Props) {
  return (
    <section className="uwe-brain-ai-panel" style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>KI-Wissensgenerierung</h2>
      <p className="uwe-hint" style={{ marginTop: 0 }}>
        Brain-Aktionen für diese Welt — Ergebnisse immer als Review-Proposal übernehmen.
      </p>
      <AiBrainSidebar worldSlug={worldSlug} defaultActionId="expand_knowledge" />
    </section>
  );
}
