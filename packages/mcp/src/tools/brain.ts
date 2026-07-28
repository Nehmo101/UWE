/**
 * UWE Brain tool catalog — the owner-private surface, and the one with a real
 * privacy tension.
 *
 * `assertPersonalBrainLocalOnly` deliberately refuses non-local AI providers for
 * personal-brain data (CLAUDE.md: "Cloud-AI ohne Kampagnen/Brain-Kontext"). An
 * MCP client such as Claude Code *is* cloud AI, so this server ships two tiers:
 *
 *  - Default: metadata only. Counts, categories and timestamps — no titles, no
 *    content, nothing that reconstructs a private note.
 *  - UWE_MCP_BRAIN_ALLOW_CONTENT=true: the owner consciously unlocks content
 *    tools for this session.
 *
 * `apps/brain` serves its own data API under `/api/life-brain/*` — das war bis
 * Abschnitt H2 Studios Route. Die Inhalts-Tools rufen sie dort auf.
 */
import type { ToolDefinition, ToolResult } from "../protocol/types";
import {
  httpTool,
  numberArg,
  objectSchema,
  stringArg,
  type ToolContext,
} from "./context";
import { errorResult, jsonResult, optionalNumber, optionalString, requireString, textResult } from "./result";

interface BrainItem {
  category?: string | null;
  factType?: string | null;
  updatedAt?: string | null;
}

interface LifeBrainSearchPayload {
  documents?: BrainItem[];
  facts?: BrainItem[];
}

function tally(items: BrainItem[], key: "category" | "factType"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const bucket = item[key]?.trim() || "(ohne)";
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

function latestTimestamp(items: BrainItem[]): string | null {
  const stamps = items
    .map((item) => item.updatedAt)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort();
  return stamps.at(-1) ?? null;
}

/**
 * Metadata-only overview. Deliberately derived client-side from the search
 * endpoint and stripped here: only counts, category names and timestamps leave
 * this function — never titles or content.
 */
function statsTool(context: ToolContext): ToolDefinition {
  return {
    name: "brain_stats",
    title: "Brain-Kennzahlen",
    description:
      "Kennzahlen des Personal Brain: Anzahl Dokumente und Fakten, Verteilung über Kategorien und Fakt-Typen, letzte Aktualisierung. Bewusst ohne Titel und ohne Inhalte — auch ohne Content-Freigabe nutzbar.",
    inputSchema: objectSchema({
      limit: numberArg("Wie viele Einträge für die Auswertung geladen werden (Default 50, max 50)."),
    }),
    annotations: { readOnlyHint: true },
    handler: async (args): Promise<ToolResult> => {
      const limit = Math.min(optionalNumber(args, "limit") ?? 50, 50);
      const result = await context.dataApi.request("/api/life-brain/search", { query: { limit } });
      if (!result.ok) {
        return errorResult(result.message);
      }

      const payload = (result.data ?? {}) as LifeBrainSearchPayload;
      const documents = Array.isArray(payload.documents) ? payload.documents : [];
      const facts = Array.isArray(payload.facts) ? payload.facts : [];

      return jsonResult(
        {
          documents: documents.length,
          facts: facts.length,
          documentsByCategory: tally(documents, "category"),
          factsByType: tally(facts, "factType"),
          lastUpdated: latestTimestamp([...documents, ...facts]),
          sampleLimit: limit,
          contentUnlocked: context.config.brainAllowContent,
          note: "Nur Metadaten. Inhalte und Titel benötigen UWE_MCP_BRAIN_ALLOW_CONTENT=true.",
        },
        context.config.maxResponseChars,
      );
    },
  };
}

function privacyTool(context: ToolContext): ToolDefinition {
  return {
    name: "brain_privacy_status",
    title: "Privacy-Status",
    description:
      "Zeigt, ob Personal-Brain-Inhalte für diese MCP-Sitzung freigegeben sind, gegen welche Endpunkte gearbeitet wird und welche Tools dadurch verfügbar sind.",
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true },
    handler: async (): Promise<ToolResult> =>
      textResult(
        [
          `Brain-App:   ${context.primary.baseUrl} (Token: ${context.primary.hasToken ? "ja" : "nein"})`,
          `Brain-API:   ${context.dataApi.baseUrl} — /api/life-brain/* (Token: ${context.dataApi.hasToken ? "ja" : "nein"})`,
          `Inhalte:     ${context.config.brainAllowContent ? "FREIGEGEBEN (UWE_MCP_BRAIN_ALLOW_CONTENT=true)" : "gesperrt — nur Metadaten"}`,
          `Schreiben:   ${context.config.allowWrites ? "erlaubt" : "gesperrt"}`,
          "",
          context.config.brainAllowContent
            ? "Achtung: Personal-Brain-Inhalte verlassen bei jedem Tool-Aufruf den Host Richtung Cloud-AI."
            : "brain_search und brain_context sind gesperrt. Freigabe nur bewusst setzen — UWE routet Personal-Brain-Kontext sonst ausschließlich an lokale Inferenz.",
        ].join("\n"),
      ),
  };
}

function contentTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "brain_search",
      title: "Personal Brain durchsuchen",
      description:
        "Semantische bzw. Keyword-Suche über Personal-Brain-Dokumente und -Fakten. Liefert Inhalte — nur verfügbar, wenn Inhalte explizit freigegeben sind.",
      inputSchema: objectSchema({
        q: stringArg("Suchbegriff (mindestens 2 Zeichen für semantische Suche)."),
        category: stringArg("Optionaler Kategorie-Filter."),
        factType: stringArg("Optionaler Fakt-Typ."),
        tag: stringArg("Optionaler Tag."),
        limit: numberArg("Maximale Trefferzahl (1–50, Default 20)."),
      }),
      path: () => "/api/life-brain/search",
      query: (args) => ({
        q: optionalString(args, "q"),
        category: optionalString(args, "category"),
        factType: optionalString(args, "factType"),
        tag: optionalString(args, "tag"),
        limit: optionalNumber(args, "limit"),
      }),
    }),

    httpTool(context, {
      name: "brain_context",
      title: "Brain-Prompt-Kontext",
      description:
        "Baut den Personal-Brain-Prompt-Kontext zu einer Frage — dieselbe Zusammenstellung, die UWE sonst nur an lokale Inferenz gibt. Nur mit expliziter Content-Freigabe.",
      inputSchema: objectSchema({ q: stringArg("Frage bzw. Thema für die Kontextauswahl.") }, ["q"]),
      path: () => "/api/life-brain/context",
      query: (args) => ({ q: requireString(args, "q") }),
    }),

    httpTool(context, {
      name: "brain_calendar",
      title: "Kalender lesen",
      description:
        "Kalendereinträge des Daily Admin OS in einem Zeitraum (Sessions, Prep, Persönliches). Enthält Titel und Orte — daher an die Content-Freigabe gebunden.",
      inputSchema: objectSchema({
        from: stringArg("Startzeitpunkt als ISO-Datum, z. B. 2026-07-01."),
        to: stringArg("Endzeitpunkt als ISO-Datum."),
        worldId: stringArg("Optionale Welt-ID."),
      }),
      path: () => "/api/calendar/events",
      query: (args) => ({
        from: optionalString(args, "from"),
        to: optionalString(args, "to"),
        worldId: optionalString(args, "worldId"),
      }),
    }),
  ];
}

export function createBrainTools(context: ToolContext): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    httpTool(context, {
      name: "brain_health",
      title: "Brain Health",
      description:
        "Liveness der Brain-App. Bewusst minimal — Brain ist owner-only, der öffentliche Probe verrät nichts über Inhalte.",
      client: "primary",
      inputSchema: objectSchema({}),
      path: () => "/api/health",
    }),
    statsTool(context),
    privacyTool(context),
  ];

  if (context.config.brainAllowContent) {
    tools.push(...contentTools(context));
  }

  return tools;
}

export const BRAIN_INSTRUCTIONS = [
  "UWE Brain ist der owner-private Bereich (Personal Brain, Daily Admin OS). Er ist bewusst restriktiv:",
  "UWE routet Personal-Brain-Kontext sonst ausschließlich an lokale Inferenz (assertPersonalBrainLocalOnly).",
  "Ohne UWE_MCP_BRAIN_ALLOW_CONTENT=true stehen nur Metadaten-Tools bereit — keine Titel, keine Inhalte.",
  "Fehlen brain_search oder brain_context, ist das kein Fehler: die Inhalts-Freigabe ist nicht gesetzt. Den Nutzer darauf hinweisen, statt Umwege zu suchen.",
].join(" ");
