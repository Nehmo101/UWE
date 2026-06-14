import type { PrepareNextSessionOutline } from "./types";

export interface PrepareSessionInput {
  lastSessionTitle?: string;
  summaryDm?: string | null;
  openPlots?: string | null;
  linkedPageTitles?: string[];
  worldSlug: string;
}

export function buildPrepareNextSessionOutline(
  input: PrepareSessionInput,
): PrepareNextSessionOutline {
  const openPlots = input.openPlots?.trim()
    ? input.openPlots
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  const linked = input.linkedPageTitles ?? [];

  return {
    summary: input.summaryDm?.trim()
      ? `Letzter Stand (${input.lastSessionTitle ?? "Session"}): ${input.summaryDm.trim().slice(0, 300)}`
      : "Zusammenfassung des letzten Stands aus Session-Daten.",
    openPlots,
    relevantNpcs: linked.filter((title) => /npc|händler|magister|könig/i.test(title)),
    relevantLocations: linked.filter((title) => /stadt|dorf|turm|wald|höhle|ort/i.test(title)),
    likelyScenes: openPlots.length > 0 ? openPlots.slice(0, 3) : ["Fortsetzung der letzten Szene"],
    encounterSuggestions: ["Patrouille", "Soziale Szene", "Erkundungs-Encounter"],
    handoutIdeas: ["Session-Recap für Spieler", "In-Game-Brief oder Karte"],
    soundboardSuggestions: ["Ambient — Dungeon", "Combat — Standard", "Reveal — Plot"],
    labelPrintList: linked.slice(0, 6).map((title) => `Label: ${title}`),
    playerKnowledge: ["Bekannte Fakten aus Spieler-Recap"],
    dmOnlyDangers: ["Versteckte Gefahren und Plot-Twists nur für DM"],
    canonWarnings:
      input.worldSlug === "terra"
        ? ["Terra-Kanon: Turm-Ebenen sind rund — keine stillen Überschreibungen."]
        : ["Kanon-Konflikte vor Übernahme prüfen."],
  };
}

export function serializePrepareNextSessionOutline(outline: PrepareNextSessionOutline): string {
  const sections: string[] = [
    "## Zusammenfassung letzter Stand",
    outline.summary,
    "",
    "## Offene Plots",
    ...(outline.openPlots.length > 0 ? outline.openPlots.map((p) => `- ${p}`) : ["- (keine)"]),
    "",
    "## Relevante NPCs",
    ...outline.relevantNpcs.map((n) => `- ${n}`),
    "",
    "## Relevante Orte",
    ...outline.relevantLocations.map((l) => `- ${l}`),
    "",
    "## Wahrscheinliche Szenen",
    ...outline.likelyScenes.map((s) => `- ${s}`),
    "",
    "## Encounter-Vorschläge",
    ...outline.encounterSuggestions.map((e) => `- ${e}`),
    "",
    "## Handouts",
    ...outline.handoutIdeas.map((h) => `- ${h}`),
    "",
    "## Soundboard",
    ...outline.soundboardSuggestions.map((s) => `- ${s}`),
    "",
    "## Label-/Druckliste",
    ...outline.labelPrintList.map((l) => `- ${l}`),
    "",
    "## Spielerwissen",
    ...outline.playerKnowledge.map((p) => `- ${p}`),
    "",
    "## DM-only Gefahren",
    ...outline.dmOnlyDangers.map((d) => `- ${d}`),
    "",
    "## Kanon-Warnungen",
    ...outline.canonWarnings.map((w) => `- ${w}`),
  ];

  return sections.join("\n");
}
