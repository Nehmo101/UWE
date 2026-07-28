/**
 * UWE Portal tool catalog — the player-facing surface.
 *
 * The Portal's own content routes are session-cookie-only, so its read tools go
 * through Studio's player-preview parameters (`accessContext=portal`,
 * `preview=player`). Those run the same `packages/database/src/permissions.ts`
 * filtering a logged-in player gets, which makes them a truthful answer to
 * "was sieht ein Spieler?" — and the basis for the dm_only leak check.
 */
import type { ToolDefinition, ToolResult } from "../protocol/types";
import {
  booleanArg,
  httpTool,
  objectSchema,
  stringArg,
  type ToolContext,
} from "./context";
import { errorResult, jsonResult, optionalString, requireString, textResult } from "./result";

interface BrainEntry {
  id?: string;
  title?: string;
  visibility?: string;
}

interface BrainPayload {
  documents?: BrainEntry[];
  facts?: BrainEntry[];
}

function readEntries(payload: unknown): BrainEntry[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const { documents, facts } = payload as BrainPayload;
  return [...(Array.isArray(documents) ? documents : []), ...(Array.isArray(facts) ? facts : [])];
}

function entryLabel(entry: BrainEntry): string {
  return entry.title?.trim() || entry.id || "(ohne Titel)";
}

/**
 * Compares the DM view of a world's brain against the player view and reports
 * anything dm_only that survived filtering. This is the invariant from
 * CLAUDE.md ("dm_only nie ins Portal") turned into something checkable.
 */
function leakCheckTool(context: ToolContext): ToolDefinition {
  return {
    name: "portal_leak_check",
    title: "dm_only-Leak-Check",
    description:
      "Vergleicht DM-Sicht und Spielersicht des Welt-Brains und meldet jeden dm_only-Eintrag, der in der Spielersicht auftaucht. Prüft die Kern-Invariante 'dm_only nie ins Portal'.",
    inputSchema: objectSchema(
      {
        worldSlug: stringArg("Slug der zu prüfenden Welt."),
        campaign: stringArg("Optionaler Kampagnen-Slug."),
      },
      ["worldSlug"],
    ),
    annotations: { readOnlyHint: true },
    handler: async (args): Promise<ToolResult> => {
      const worldSlug = requireString(args, "worldSlug");
      const campaign = optionalString(args, "campaign");
      const path = `/api/worlds/${encodeURIComponent(worldSlug)}/brain`;

      const [dmView, playerView] = await Promise.all([
        context.dataApi.request(path, { query: { campaign, accessContext: "dm" } }),
        context.dataApi.request(path, { query: { campaign, accessContext: "portal" } }),
      ]);

      if (!dmView.ok) return errorResult(dmView.message);
      if (!playerView.ok) return errorResult(playerView.message);

      const dmEntries = readEntries(dmView.data);
      const playerEntries = readEntries(playerView.data);
      const leaked = playerEntries.filter((entry) => entry.visibility === "dm_only");

      const report = {
        world: worldSlug,
        campaign: campaign ?? null,
        dmEntries: dmEntries.length,
        playerEntries: playerEntries.length,
        filteredOut: dmEntries.length - playerEntries.length,
        // Titles only — the correctly filtered dm_only *content* is never echoed.
        leakedTitles: leaked.map(entryLabel),
        verdict:
          leaked.length === 0
            ? "OK — kein dm_only-Eintrag in der Spielersicht."
            : `LEAK — ${leaked.length} dm_only-Eintrag/-Einträge in der Spielersicht.`,
      };

      return leaked.length === 0
        ? jsonResult(report, context.config.maxResponseChars)
        : {
            content: [
              { type: "text", text: JSON.stringify(report, null, 2) },
            ],
            isError: true,
          };
    },
  };
}

function configTool(context: ToolContext): ToolDefinition {
  return {
    name: "portal_config",
    title: "Portal-Konfiguration",
    description:
      "Zeigt, gegen welche Endpunkte dieser MCP-Server arbeitet und ob ein API-Token vorliegt. Erste Anlaufstelle bei 401/403 oder 'nicht erreichbar'.",
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true },
    handler: async (): Promise<ToolResult> =>
      textResult(
        [
          `Portal:      ${context.primary.baseUrl} (Token: ${context.primary.hasToken ? "ja" : "nein"})`,
          `Studio-API:  ${context.dataApi.baseUrl} (Token: ${context.dataApi.hasToken ? "ja" : "nein"})`,
          "Spielersicht-Tools lesen über Studio mit accessContext=portal bzw. preview=player.",
        ].join("\n"),
      ),
  };
}

export function createPortalTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "portal_health",
      title: "Portal Health",
      description:
        "Liveness des Spieler-Portals. Antwortet auch ohne Token — zeigt, ob der Portal-Prozess läuft.",
      client: "primary",
      inputSchema: objectSchema({}),
      path: () => "/api/health",
    }),

    httpTool(context, {
      name: "portal_maintenance_status",
      title: "Wartungsmodus",
      description:
        "Wartungsmodus des Portals. Erklärt, warum Spieler statt Inhalten eine Wartungsseite sehen.",
      client: "primary",
      inputSchema: objectSchema({}),
      path: () => "/api/maintenance/status",
    }),

    httpTool(context, {
      name: "portal_player_view_brain",
      title: "Spielersicht: Welt-Brain",
      description:
        "Welt-Brain in der gefilterten Spielersicht (accessContext=portal). Zeigt genau das, was ein eingeloggter Spieler im Portal sehen darf — dm_only ist herausgefiltert.",
      inputSchema: objectSchema(
        {
          worldSlug: stringArg("Slug der Welt."),
          campaign: stringArg("Optionaler Kampagnen-Slug."),
        },
        ["worldSlug"],
      ),
      path: (args) => `/api/worlds/${encodeURIComponent(requireString(args, "worldSlug"))}/brain`,
      query: (args) => ({
        campaign: optionalString(args, "campaign"),
        accessContext: "portal",
      }),
    }),

    httpTool(context, {
      name: "portal_player_view_graph",
      title: "Spielersicht: Welt-Graph",
      description:
        "Welt-Graph in der Spielervorschau (preview=player). Nützlich, um zu prüfen, welche Knoten und Kanten Spieler tatsächlich sehen.",
      inputSchema: objectSchema(
        {
          worldSlug: stringArg("Slug der Welt."),
          campaign: stringArg("Optionaler Kampagnen-Slug."),
          includeIsolated: booleanArg("Reserviert für zukünftige Filter; ohne Wirkung."),
        },
        ["worldSlug"],
      ),
      path: (args) => `/api/worlds/${encodeURIComponent(requireString(args, "worldSlug"))}/graph`,
      query: (args) => ({
        campaign: optionalString(args, "campaign"),
        preview: "player",
      }),
    }),

    leakCheckTool(context),
    configTool(context),
  ];
}

export const PORTAL_INSTRUCTIONS = [
  "UWE Portal ist das Spieler-Wiki. Diese Tools beantworten vor allem eine Frage: Was sieht ein Spieler wirklich?",
  "Die Spielersicht-Tools lesen über Studio mit accessContext=portal bzw. preview=player und durchlaufen dieselbe Filterung wie das Portal.",
  "portal_leak_check prüft die Kern-Invariante: dm_only-Inhalte dürfen nie in der Spielersicht landen. Ein Fund ist ein Sicherheitsbefund, kein Hinweis.",
  "Der Portal-MCP schreibt nichts — Portal-Inhalte werden ausschließlich in Studio gepflegt.",
].join(" ");
