/**
 * UWE Studio tool catalog — the DM/admin surface.
 *
 * Every tool maps onto an existing Studio route, so the request passes through
 * `guardStudioApiRequest` / `requireAdminApiAuth` exactly as a browser would:
 * the API token's role and scopes decide what is reachable. Mutating tools are
 * registered only when UWE_MCP_ALLOW_WRITES=true.
 */
import type { ToolDefinition } from "../protocol/types";
import {
  booleanArg,
  enumArg,
  httpTool,
  numberArg,
  objectSchema,
  stringArg,
  type ToolContext,
} from "./context";
import { optionalNumber, optionalString, requireString } from "./result";

const NO_ARGS = objectSchema({});

function readTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "studio_health",
      title: "Studio Health",
      description:
        "Health-Report von UWE Studio: Datenbank, Migrationen, Storage, Seeds, Proxy, Mail und Version. Erster Griff, wenn etwas 'kaputt' wirkt.",
      client: "primary",
      inputSchema: NO_ARGS,
      path: () => "/api/health",
    }),

    httpTool(context, {
      name: "studio_search",
      title: "Studio-Suche",
      description:
        "Domänenübergreifende Suche über Wiki-Seiten und Admin-Objekte (Ideen, Projekte, Kontakte …). Mindestens 2 Zeichen. Liefert Titel, Gruppe und Studio-Link.",
      inputSchema: objectSchema({ q: stringArg("Suchbegriff, mindestens 2 Zeichen.") }, ["q"]),
      path: () => "/api/command/search",
      query: (args) => ({ q: requireString(args, "q") }),
    }),

    httpTool(context, {
      name: "studio_world_brain",
      title: "Welt-Brain lesen",
      description:
        "DnD-Brain einer Welt: Dokumente, Fakten und Welt-Zusammenfassung. Wer der Welt zugeordnet ist, sieht alles darin.",
      inputSchema: objectSchema(
        {
          worldSlug: stringArg("Slug der Welt, z. B. 'aventurien'."),
          campaign: stringArg("Optionaler Kampagnen-Slug zum Filtern."),
          accessContext: enumArg("Sichtbarkeitskontext (Default: dm).", ["dm", "portal"]),
        },
        ["worldSlug"],
      ),
      path: (args) => `/api/worlds/${encodeURIComponent(requireString(args, "worldSlug"))}/brain`,
      query: (args) => ({
        campaign: optionalString(args, "campaign"),
        accessContext: optionalString(args, "accessContext"),
      }),
    }),

    httpTool(context, {
      name: "studio_world_graph",
      title: "Welt-Graph lesen",
      description:
        "Beziehungsgraph einer Welt (Knoten + Kanten). Optional auf Kategorien, Tags oder eine Fokus-Seite eingegrenzt. preview=true zeigt die Spielervorschau.",
      inputSchema: objectSchema(
        {
          worldSlug: stringArg("Slug der Welt."),
          campaign: stringArg("Optionaler Kampagnen-Slug."),
          category: stringArg("Optionale Knoten-Kategorie."),
          tag: stringArg("Optionaler Tag-Filter."),
          focusPageId: stringArg("Optionale Seiten-ID als Graph-Zentrum."),
          preview: booleanArg("true rendert die Spielervorschau statt der DM-Sicht."),
        },
        ["worldSlug"],
      ),
      path: (args) => `/api/worlds/${encodeURIComponent(requireString(args, "worldSlug"))}/graph`,
      query: (args) => ({
        campaign: optionalString(args, "campaign"),
        category: optionalString(args, "category"),
        tag: optionalString(args, "tag"),
        focusPageId: optionalString(args, "focusPageId"),
        preview: args.preview === true ? "player" : undefined,
      }),
    }),

    httpTool(context, {
      name: "studio_settings",
      title: "Einstellungen lesen",
      description:
        "Aktuelle System-Einstellungen von UWE (Portal-Freigabe, Backup-Zeitplan, KI-Defaults, Feature-Flags …). Nur lesend.",
      inputSchema: NO_ARGS,
      path: () => "/api/settings",
    }),

    httpTool(context, {
      name: "studio_jobs",
      title: "Jobs auflisten",
      description:
        "Job-Queue mit Status-Zusammenfassung: Exporte, Importe, KI-Läufe, Backups. Filterbar nach Status, Typ und Welt.",
      inputSchema: objectSchema({
        status: stringArg("Optionaler Status-Filter (z. B. 'queued', 'failed')."),
        type: stringArg("Optionaler Job-Typ."),
        worldSlug: stringArg("Optionaler Welt-Slug."),
        limit: numberArg("Maximale Anzahl (Default 50)."),
        offset: numberArg("Offset für Paginierung."),
      }),
      path: () => "/api/jobs",
      query: (args) => ({
        status: optionalString(args, "status"),
        type: optionalString(args, "type"),
        worldSlug: optionalString(args, "worldSlug"),
        limit: optionalNumber(args, "limit"),
        offset: optionalNumber(args, "offset"),
      }),
    }),

    httpTool(context, {
      name: "studio_ai_models",
      title: "KI-Modelle auflisten",
      description:
        "Verfügbare KI-Modelle je Provider (lokaler RTX-Connector, Cloud-Provider). Zeigt, was der AI-Router gerade anbieten kann.",
      inputSchema: objectSchema({
        provider: stringArg("Optionaler Provider-Filter, z. B. 'local_rtx'."),
      }),
      path: () => "/api/ai/models",
      query: (args) => ({ provider: optionalString(args, "provider") }),
    }),

    httpTool(context, {
      name: "studio_dnd_spell_search",
      title: "Zauber suchen",
      description:
        "Zaubersuche über die konfigurierten DnD-Referenzquellen (Open5e / SRD). Liefert Grad, Schule und Beschreibung.",
      inputSchema: objectSchema({ q: stringArg("Name oder Teil eines Zaubernamens.") }, ["q"]),
      path: () => "/api/dnd/spells/search",
      query: (args) => ({ q: requireString(args, "q") }),
    }),

    httpTool(context, {
      name: "studio_dnd_equipment_search",
      title: "Ausrüstung suchen",
      description:
        "Ausrüstungs- und Magieitem-Suche über die konfigurierten DnD-Referenzquellen.",
      inputSchema: objectSchema({ q: stringArg("Name oder Teil eines Gegenstandsnamens.") }, ["q"]),
      path: () => "/api/dnd/equipment/search",
      query: (args) => ({ q: requireString(args, "q") }),
    }),

    httpTool(context, {
      name: "studio_admin_status",
      title: "Admin-Status",
      description:
        "Admin-Dashboard-Status als JSON (Dienste, Inferenz, Rate-Limiter, Warnungen). Erfordert einen Token mit Scope 'admin_read'.",
      inputSchema: NO_ARGS,
      path: () => "/api/admin/status",
    }),

    httpTool(context, {
      name: "studio_audit_log",
      title: "Audit-Log lesen",
      description:
        "Audit-Log-Einträge (Logins, Rechteverweigerungen, Admin-Aktionen). Erfordert Scope 'admin_read'. Für Sicherheitsfragen der schnellste Weg.",
      inputSchema: objectSchema({
        action: stringArg("Kommaseparierte Aktionen, z. B. 'login_failed,authz_denied'."),
        actorUserId: stringArg("Optionale Nutzer-ID."),
        worldId: stringArg("Optionale Welt-ID."),
        limit: numberArg("Maximale Anzahl (Default 50)."),
        offset: numberArg("Offset für Paginierung."),
      }),
      path: () => "/api/admin/audit-log",
      query: (args) => ({
        action: optionalString(args, "action"),
        actorUserId: optionalString(args, "actorUserId"),
        worldId: optionalString(args, "worldId"),
        limit: optionalNumber(args, "limit"),
        offset: optionalNumber(args, "offset"),
      }),
    }),
  ];
}

function writeTools(context: ToolContext): ToolDefinition[] {
  return [
    httpTool(context, {
      name: "studio_create_brain_entry",
      title: "Brain-Eintrag anlegen",
      description:
        "Legt ein Brain-Dokument oder einen Fakt in einer Welt an. Wer der Welt zugeordnet ist, sieht den Eintrag.",
      method: "POST",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: objectSchema(
        {
          worldSlug: stringArg("Slug der Welt."),
          kind: enumArg("Art des Eintrags.", ["document", "fact"]),
          title: stringArg("Titel des Eintrags."),
          content: stringArg("Inhalt (Markdown erlaubt)."),
          campaignId: stringArg("Optionale Kampagnen-ID."),
        },
        ["worldSlug", "kind", "title"],
      ),
      path: (args) => `/api/worlds/${encodeURIComponent(requireString(args, "worldSlug"))}/brain`,
      body: (args) => ({
        kind: requireString(args, "kind"),
        title: requireString(args, "title"),
        content: optionalString(args, "content") ?? "",
        source: "manual",
        campaignId: optionalString(args, "campaignId") ?? null,
      }),
    }),

    httpTool(context, {
      name: "studio_enqueue_job",
      title: "Job einreihen",
      description:
        "Reiht einen Job in die Studio-Queue ein (z. B. Export, Import, Backup). Läuft asynchron; Status danach über studio_jobs abfragen.",
      method: "POST",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: objectSchema(
        {
          type: stringArg("Job-Typ, wie von studio_jobs unter labels.types gemeldet."),
          title: stringArg("Anzeigename des Jobs."),
          worldSlug: stringArg("Optionaler Welt-Slug."),
        },
        ["type", "title"],
      ),
      path: () => "/api/jobs",
      body: (args) => ({
        type: requireString(args, "type"),
        title: requireString(args, "title"),
        worldSlug: optionalString(args, "worldSlug"),
      }),
    }),
  ];
}

export function createStudioTools(context: ToolContext): ToolDefinition[] {
  return context.config.allowWrites
    ? [...readTools(context), ...writeTools(context)]
    : readTools(context);
}

export const STUDIO_INSTRUCTIONS = [
  "UWE Studio ist die DM- und Admin-Oberfläche. Diese Tools sprechen die laufende Studio-Instanz über ihre HTTP-API an;",
  "Die Scopes des API-Tokens entscheiden, was erreichbar ist.",
  "Bei 401/403 zuerst Token und Scopes prüfen (Studio → Admin → API-Tokens), nicht die Guards umgehen.",
].join(" ");
