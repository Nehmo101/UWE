"use client";

import { AiBrainSidebar } from "./AiBrainSidebar";

interface Props {
  worldSlug: string;
  campaignId?: string;
}

export function BrainAiGeneratePanel({ worldSlug, campaignId: _campaignId }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight">KI-Wissensgenerierung</h2>
      <p className="text-sm text-muted-foreground" style={{ marginTop: 0 }}>
        Brain-Aktionen für diese Welt — Ergebnisse immer als Review-Proposal übernehmen. Läuft über
        den Maschinenraum (lokal), nicht über veraltete Ollama-Direktauswahl.
      </p>
      <AiBrainSidebar
        worldSlug={worldSlug}
        defaultActionId="expand_knowledge"
        variant="store"
      />
    </section>
  );
}
