/**
 * Server factories — one MCP server per UWE product.
 *
 * Vier Server statt einem, weil das Repo die Produkttrennung hart durchsetzt
 * (`@uwe/product-contracts` → APP_AUDIENCE, scripts/product-boundary-check.mjs)
 * und weil Brain und Family einzeln zuschaltbar sein müssen: wer Studio und
 * Portal an einen Agenten hängt, will den owner-privaten Bereich und den
 * Haushalt nicht zwangsläufig mitliefern.
 */
import { loadConfig, type McpSurface } from "./client/config";
import type { McpServerDefinition, PromptDefinition } from "./protocol/types";
import { BRAIN_INSTRUCTIONS, createBrainTools } from "./tools/brain";
import { createToolContext } from "./tools/context";
import { FAMILY_INSTRUCTIONS, createFamilyTools } from "./tools/family";
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
    description: "Spielersicht einer Welt prüfen.",
    arguments: [{ name: "worldSlug", description: "Slug der Welt", required: true }],
    build: (args) => [
      {
        role: "user",
        content: {
          type: "text",
          text: `Prüfe die Spielersicht der UWE-Welt "${args.worldSlug ?? "(bitte erfragen)"}". Sieh dir mit portal_player_view_brain und portal_player_view_graph an, was ein zugeordneter Spieler tatsächlich sieht, und melde, ob etwas Wichtiges fehlt.`,
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

const FAMILY_PROMPTS: PromptDefinition[] = [
  {
    name: "family-week",
    description: "Die kommende Woche im Haushalt zusammenfassen.",
    build: userMessage(
      "Fasse die kommende Woche im Haushalt zusammen. Nutze family_members für die Personen, family_calendar_upcoming mit includeAnniversaries für Termine und Geburtstage und family_health_due für anstehende Arzt- und Tierarzttermine. Ordne die Termine nach Person und nenne, was Vorbereitung braucht.",
    ),
  },
  {
    name: "family-shopping",
    description: "Einkaufsliste sichten und mit den Rezepten der Woche abgleichen.",
    build: userMessage(
      "Sieh dir mit family_shopping_list die offene Einkaufsliste an und gleiche sie mit family_recipes ab. Nenne, was fehlen könnte, und fasse die Liste nach Kategorien zusammen.",
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

  if (surface === "family") {
    return {
      name: "uwe-family",
      version: UWE_MCP_VERSION,
      instructions: FAMILY_INSTRUCTIONS,
      tools: createFamilyTools(context),
      prompts: FAMILY_PROMPTS,
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
