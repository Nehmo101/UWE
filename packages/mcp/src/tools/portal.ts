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
import { optionalString, requireString, textResult } from "./result";

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

    configTool(context),
  ];
}

export const PORTAL_INSTRUCTIONS = [
  "UWE Portal ist das Spieler-Wiki. Wer einer Welt zugeordnet ist, sieht dort alles darin.",
  "Die Spielersicht-Tools lesen über Studio mit preview=player und laufen durch dieselben Guards wie das Portal.",
  "Der Portal-MCP schreibt nichts — Portal-Inhalte werden ausschließlich in Studio gepflegt.",
].join(" ");
