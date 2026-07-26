/**
 * Server factories — one MCP server per UWE product.
 *
 * Three servers rather than one, because the repo enforces a hard three-product
 * split (`@uwe/product-contracts` → APP_AUDIENCE, scripts/product-boundary-check.mjs)
 * and because Brain must be separately switchable: an operator can wire Studio
 * and Portal into an agent while leaving the owner-private surface out entirely.
 */
import { loadConfig, type McpSurface } from "./client/config";
import type { McpServerDefinition, PromptDefinition } from "./protocol/types";
import { BRAIN_INSTRUCTIONS, createBrainTools } from "./tools/brain";
import { createToolContext } from "./tools/context";
import { PORTAL_INSTRUCTIONS, createPortalTools } from "./tools/portal";
import { STUDIO_INSTRUCTIONS, createStudioTools } from "./tools/studio";

export const UWE_MCP_VERSION = "1.0.0";

function userMessage(text: string): PromptDefinition["build"] {
  return () => [{ role: "user", content: { type: "text", text } }];
}

const STUDIO_PROMPTS: PromptDefinition[] = [
  {
    name: "world-status",
    description: "Zustand einer Welt zusammenfassen: Brain-Einträge, Graph, offene Jobs.",
    arguments: [{ name: "worldSlug", description: "Slug der Welt", required: true }],
    build: (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: `Fasse den Zustand der UWE-Welt "${args.worldSlug ?? "(bitte erfragen)"}" zusammen. Nutze studio_world_brain für Dokumente und Fakten, studio_world_graph für die Struktur und studio_jobs für offene Aufgaben. Nenne am Ende konkrete Lücken oder Inkonsistenzen.`,
        },
      },
    ],
  },
  {
    name: "health-triage",
    description: "Studio-Health und Admin-Status prüfen und Probleme priorisieren.",
    build: userMessage(
      "Prüfe mit studio_health und studio_admin_status den Zustand von UWE Studio. Liste gefundene Probleme nach Dringlichkeit und nenne pro Punkt den nächsten konkreten Schritt.",
    ),
  },
];

const PORTAL_PROMPTS: PromptDefinition[] = [
  {
    name: "player-view-audit",
    description: "Spielersicht einer Welt prüfen und dm_only-Lecks aufdecken.",
    arguments: [{ name: "worldSlug", description: "Slug der Welt", required: true }],
    build: (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: `Prüfe die Spielersicht der UWE-Welt "${args.worldSlug ?? "(bitte erfragen)"}". Führe zuerst portal_leak_check aus. Sieh dir danach mit portal_player_view_brain an, was Spieler tatsächlich sehen, und melde, ob etwas Wichtiges fehlt oder etwas Vertrauliches sichtbar ist.`,
        },
      },
    ],
  },
];

const BRAIN_PROMPTS: PromptDefinition[] = [
  {
    name: "brain-overview",
    description: "Zustand des Personal Brain anhand von Metadaten einschätzen.",
    build: userMessage(
      "Verschaffe mir mit brain_health und brain_stats einen Überblick über mein Personal Brain. Beschreibe Umfang und Verteilung über Kategorien und sage, ob etwas ungepflegt wirkt. Nutze keine Inhalts-Tools, wenn sie nicht verfügbar sind — weise stattdessen auf die fehlende Content-Freigabe hin.",
    ),
  },
];

export function createServer(
  surface: McpSurface,
  env: NodeJS.ProcessEnv = process.env,
): McpServerDefinition {
  const config = loadConfig(surface, env);
  const context = createToolContext(config);

  if (surface === "studio") {
    return {
      name: "uwe-studio",
      version: UWE_MCP_VERSION,
      instructions: STUDIO_INSTRUCTIONS,
      tools: createStudioTools(context),
      prompts: STUDIO_PROMPTS,
    };
  }

  if (surface === "portal") {
    return {
      name: "uwe-portal",
      version: UWE_MCP_VERSION,
      instructions: PORTAL_INSTRUCTIONS,
      tools: createPortalTools(context),
      prompts: PORTAL_PROMPTS,
    };
  }

  return {
    name: "uwe-brain",
    version: UWE_MCP_VERSION,
    instructions: BRAIN_INSTRUCTIONS,
    tools: createBrainTools(context),
    prompts: BRAIN_PROMPTS,
  };
}
