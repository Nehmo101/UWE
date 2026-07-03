import type { PrepareNextSessionOutline } from "./types";

export interface PrepareSessionLinkedPage {
  title: string;
  /** Page type from the wiki (npc, location, dungeon, …) — preferred over title guessing. */
  type?: string;
}

export interface PrepareSessionInput {
  lastSessionTitle?: string;
  summaryDm?: string | null;
  openPlots?: string | null;
  playerDecisions?: string | null;
  /** Legacy: titles only — falls back to title-based guessing. */
  linkedPageTitles?: string[];
  /** Preferred: pages with wiki type for exact NPC/location matching. */
  linkedPages?: PrepareSessionLinkedPage[];
  worldSlug: string;
}

const NPC_PAGE_TYPES = ["npc", "player_character", "monster", "faction"];
const LOCATION_PAGE_TYPES = ["location", "region", "dungeon", "dungeon_level", "room", "map"];

const NPC_TITLE_PATTERN = /npc|händler|magister|könig|königin|wirt|hauptmann/i;
const LOCATION_TITLE_PATTERN = /stadt|dorf|turm|wald|höhle|ort|ruine|hafen|tempel/i;

function splitLines(value?: string | null): string[] {
  return value?.trim()
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function suggestEncountersFromPlots(openPlots: string[]): string[] {
  const suggestions: string[] = [];
  for (const plot of openPlots) {
    if (/kampf|angriff|monster|bedroh|jagd|krieg/i.test(plot)) {
      suggestions.push(`Kampf-Encounter zu: ${plot}`);
    } else if (/verhandl|gespräch|intrige|rat|fest|audienz/i.test(plot)) {
      suggestions.push(`Soziale Szene zu: ${plot}`);
    } else if (/reise|suche|erkund|expedition|karte/i.test(plot)) {
      suggestions.push(`Erkundungs-Encounter zu: ${plot}`);
    }
  }
  if (suggestions.length === 0) {
    suggestions.push("Patrouille", "Soziale Szene", "Erkundungs-Encounter");
  }
  return suggestions.slice(0, 4);
}

/**
 * Deterministic offline fallback for session prep. The primary path is the
 * prepare_next_session AI task (Brain-Aktion „next_session_prep“) — this
 * outline only gives orientation when no model is reachable.
 */
export function buildPrepareNextSessionOutline(
  input: PrepareSessionInput,
): PrepareNextSessionOutline {
  const openPlots = splitLines(input.openPlots);
  const playerDecisions = splitLines(input.playerDecisions);

  const pages: PrepareSessionLinkedPage[] =
    input.linkedPages ?? (input.linkedPageTitles ?? []).map((title) => ({ title }));

  const relevantNpcs = pages
    .filter((page) =>
      page.type ? NPC_PAGE_TYPES.includes(page.type) : NPC_TITLE_PATTERN.test(page.title),
    )
    .map((page) => page.title);

  const relevantLocations = pages
    .filter((page) =>
      page.type
        ? LOCATION_PAGE_TYPES.includes(page.type)
        : LOCATION_TITLE_PATTERN.test(page.title),
    )
    .map((page) => page.title);

  return {
    summary: input.summaryDm?.trim()
      ? `Letzter Stand (${input.lastSessionTitle ?? "Session"}): ${input.summaryDm.trim().slice(0, 300)}`
      : "Zusammenfassung des letzten Stands aus Session-Daten.",
    openPlots,
    relevantNpcs,
    relevantLocations,
    likelyScenes: openPlots.length > 0 ? openPlots.slice(0, 3) : ["Fortsetzung der letzten Szene"],
    encounterSuggestions: suggestEncountersFromPlots(openPlots),
    handoutIdeas: ["Session-Recap für Spieler", "In-Game-Brief oder Karte"],
    soundboardSuggestions: ["Ambient — Dungeon", "Combat — Standard", "Reveal — Plot"],
    labelPrintList: pages.slice(0, 6).map((page) => `Label: ${page.title}`),
    playerKnowledge:
      playerDecisions.length > 0
        ? playerDecisions.map((decision) => `Spielerentscheidung: ${decision}`)
        : ["Bekannte Fakten aus Spieler-Recap"],
    dmOnlyDangers: ["Versteckte Gefahren und Plot-Twists nur für DM"],
    canonWarnings: ["Kanon-Konflikte vor Übernahme prüfen — Vorschläge nie ungeprüft übernehmen."],
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
