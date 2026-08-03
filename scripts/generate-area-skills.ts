/**
 * Generator für die vier UWE-Bereichs-Skills (/uwestudio /uweportal /uwebrain /uwefamily).
 *
 * Warum es das gibt: die Vorgänger dieser Skills waren handgepflegte Slash-Commands,
 * und niemand prüfte sie. Ergebnis war stiller Drift — `portal_leak_check` stand noch
 * als Pflichtschritt in `/uweportal`, obwohl das Tool längst entfernt war, und
 * `family_day_brief` fehlte am Tag seiner Einführung.
 *
 * Deshalb sind die Faktenteile jedes Skills generiert und liegen zwischen Markern:
 *
 *     <!-- uwe:generated:<id> start -->  … generiert …  <!-- uwe:generated:<id> end -->
 *
 * Alles außerhalb der Marker ist handgeschrieben und wird nie angefasst.
 *
 * Die Tool-Tabelle kommt aus `createServer()` selbst, nicht aus einer Textsuche:
 * der Server wird zweimal gebaut — einmal mit gesetzten Freigabe-Flags, einmal ohne.
 * Die Differenz *ist* die Gate-Spalte. Damit kann die Tabelle nicht von der Realität
 * abweichen, solange sie neu erzeugt wird.
 *
 * Aufruf: `pnpm skills:sync`. Geprüft wird das in `scripts/area-skills-sync.test.ts`.
 */
import fs from "node:fs";
import path from "node:path";

import type { McpSurface } from "../packages/mcp/src/client/config";
import { createServer } from "../packages/mcp/src/servers";

const root = path.resolve(import.meta.dirname, "..");

export interface AreaDefinition {
  /** Skill-Ordner unter .claude/skills/ und zugleich der Slash-Name. */
  readonly id: string;
  readonly label: string;
  /** MCP-Fläche in packages/mcp. */
  readonly surface: McpSurface;
  /** Ordner unter apps/. */
  readonly app: string;
  /** Häkchen aus packages/auth/src/area-access.ts. */
  readonly checkbox: string;
  readonly database: string;
}

export const AREAS: readonly AreaDefinition[] = [
  {
    id: "uwestudio",
    label: "UWE Studio",
    surface: "studio",
    app: "studio",
    checkbox: "studio",
    database: "uwe.db",
  },
  {
    id: "uweportal",
    label: "UWE Portal",
    surface: "portal",
    app: "portal",
    checkbox: "portal",
    database: "uwe.db (lesend, über Studio-Guards)",
  },
  {
    id: "uwebrain",
    label: "UWE Brain",
    surface: "brain",
    app: "brain",
    checkbox: "brain",
    database: "uwe-brain.db",
  },
  {
    id: "uwefamily",
    label: "UWE Family",
    surface: "family",
    app: "family",
    checkbox: "family",
    database: "uwe-family.db",
  },
];

/** Ein generierter Block: welche Datei, welcher Marker, welcher Inhalt. */
export interface GeneratedBlock {
  /** Repo-relativer Pfad. */
  readonly file: string;
  readonly id: string;
  readonly body: string;
}

// ---------------------------------------------------------------------------
// Quellen
// ---------------------------------------------------------------------------

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as Record<
    string,
    unknown
  >;
}

/** Port aus dem `dev`-Script der App — die einzige Stelle, an der er wirklich steht. */
function portOf(app: string): string {
  const pkg = readJson(`apps/${app}/package.json`);
  const dev = String((pkg.scripts as Record<string, string> | undefined)?.dev ?? "");
  return /--port\s+(\d+)/.exec(dev)?.[1] ?? "—";
}

function uwePackagesOf(app: string): string[] {
  const pkg = readJson(`apps/${app}/package.json`);
  return Object.keys((pkg.dependencies as Record<string, string> | undefined) ?? {})
    .filter((name) => name.startsWith("@uwe/"))
    .sort();
}

function listDirs(absolute: string): string[] {
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Zählt Dateien mit gegebenem Namen unterhalb eines Verzeichnisses. */
function countFiles(absolute: string, fileName: string): number {
  if (!fs.existsSync(absolute)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      total += countFiles(path.join(absolute, entry.name), fileName);
    } else if (entry.name === fileName) {
      total += 1;
    }
  }
  return total;
}

interface SegmentCount {
  readonly segment: string;
  readonly count: number;
}

/**
 * Top-Level-Segmente unter `app/` mit der Zahl der Seiten darunter.
 * `api` fällt heraus — die Routen werden getrennt gezählt.
 */
function pageSegments(app: string): SegmentCount[] {
  const appDir = path.join(root, "apps", app, "app");
  return listDirs(appDir)
    .filter((name) => name !== "api")
    .map((segment) => ({ segment, count: countFiles(path.join(appDir, segment), "page.tsx") }))
    .filter((entry) => entry.count > 0);
}

function apiSegments(app: string): SegmentCount[] {
  const apiDir = path.join(root, "apps", app, "app", "api");
  return listDirs(apiDir)
    .map((segment) => ({ segment, count: countFiles(path.join(apiDir, segment), "route.ts") }))
    .filter((entry) => entry.count > 0);
}

/** Server Actions liegen als `*-actions.ts` direkt unter `app/`. */
function serverActions(app: string): string[] {
  const appDir = path.join(root, "apps", app, "app");
  if (!fs.existsSync(appDir)) return [];
  return fs
    .readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith("-actions.ts"))
    .map((entry) => entry.name)
    .sort();
}

interface McpToolRow {
  readonly name: string;
  readonly gate: string;
  readonly description: string;
}

/**
 * Tool-Katalog einer Fläche. Zweimal gebaut: mit allen Freigaben und ohne.
 * Was nur im ersten Lauf auftaucht, ist gegated — genau das steht in der Gate-Spalte.
 *
 * `createServer` baut nur Definitionen; die Handler laufen nicht, es geht kein
 * Request raus und `loadConfig` wirft nicht.
 */
function mcpTools(surface: McpSurface): McpToolRow[] {
  const openEnv = {
    UWE_MCP_ALLOW_WRITES: "true",
    UWE_MCP_BRAIN_ALLOW_CONTENT: "true",
  } as NodeJS.ProcessEnv;
  const closedEnv = {} as NodeJS.ProcessEnv;

  const all = createServer(surface, openEnv).tools;
  const alwaysOn = new Set(createServer(surface, closedEnv).tools.map((tool) => tool.name));

  return all.map((tool) => ({
    name: tool.name,
    gate: alwaysOn.has(tool.name)
      ? "immer"
      : tool.name.startsWith("brain_")
        ? "`UWE_MCP_BRAIN_ALLOW_CONTENT`"
        : "`UWE_MCP_ALLOW_WRITES`",
    description: tool.description.replace(/\s+/g, " ").trim(),
  }));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Abkürzungen, deren Punkt keine Satzgrenze ist. Ohne diese Liste endet
 * `studio_enqueue_job` in der Tabelle bei „(z." und `brain_search` bei „Semantische bzw.".
 */
const ABBREVIATIONS = new Set([
  "z", "B", "bzw", "ca", "usw", "etc", "ggf", "evtl", "inkl", "u", "a", "d", "h", "s", "Nr", "Abs",
]);

const MAX_CELL_CHARS = 170;

/** Erste echte Satzgrenze — die Tabelle soll lesbar bleiben, nicht vollständig sein. */
function firstSentence(text: string): string {
  let sentence = text;
  for (const match of text.matchAll(/([^\s.]+)\.(\s+|$)/g)) {
    // Führende Klammern/Anführungszeichen abziehen, sonst ist „(z" nicht „z".
    if (ABBREVIATIONS.has(match[1].replace(/^[^\p{L}\p{N}]+/u, ""))) continue;
    sentence = text.slice(0, (match.index ?? 0) + match[0].trimEnd().length);
    break;
  }
  if (sentence.length > MAX_CELL_CHARS) {
    sentence = `${sentence.slice(0, MAX_CELL_CHARS).replace(/\s+\S*$/, "")} …`;
  }
  return sentence.replace(/\|/g, "\\|");
}

function renderMcpBlock(area: AreaDefinition): string {
  const tools = mcpTools(area.surface);
  const gated = tools.filter((tool) => tool.gate !== "immer");

  const lines = [
    `${tools.length} Tools am MCP-Server \`uwe-${area.surface}\`${
      gated.length > 0 ? `, davon ${gated.length} nur mit Freigabe-Flag` : " — alle immer verfügbar"
    }.`,
    "",
    "| Tool | Verfügbar | Zweck |",
    "|------|-----------|-------|",
    ...tools.map((tool) => `| \`${tool.name}\` | ${tool.gate} | ${firstSentence(tool.description)} |`),
  ];

  if (gated.length > 0) {
    lines.push(
      "",
      "Fehlt ein gegatetes Tool, ist das **kein Fehler** — dann ist das Flag nicht gesetzt.",
      "Das dem Nutzer sagen, statt einen Umweg zu suchen.",
    );
  }

  return lines.join("\n");
}

function renderSegmentList(entries: SegmentCount[]): string {
  if (entries.length === 0) return "_(keine)_";
  return entries.map((entry) => `\`${entry.segment}\` (${entry.count})`).join(" · ");
}

function renderKarteBlock(area: AreaDefinition): string {
  const pages = pageSegments(area.app);
  const api = apiSegments(area.app);
  const actions = serverActions(area.app);
  const packages = uwePackagesOf(area.app);

  const pageTotal = countFiles(path.join(root, "apps", area.app, "app"), "page.tsx");
  const routeTotal = countFiles(path.join(root, "apps", area.app, "app"), "route.ts");

  return [
    "| | |",
    "|---|---|",
    `| App | \`apps/${area.app}\` |`,
    `| Port | ${portOf(area.app)} |`,
    `| Häkchen | \`${area.checkbox}\` |`,
    `| Datenbank | ${area.database} |`,
    `| MCP-Server | \`uwe-${area.surface}\` |`,
    `| Seiten | ${pageTotal} |`,
    `| API-Routen | ${routeTotal} |`,
    "",
    "**Seiten-Bereiche** (Top-Level unter `app/`, Zahl = Seiten darunter)",
    "",
    renderSegmentList(pages),
    "",
    "**API-Bereiche** (Top-Level unter `app/api/`, Zahl = Route-Handler darunter)",
    "",
    renderSegmentList(api),
    "",
    `**Server Actions** (\`apps/${area.app}/app/*-actions.ts\`, ${actions.length})`,
    "",
    actions.length > 0 ? actions.map((name) => `\`${name}\``).join(" · ") : "_(keine)_",
    "",
    `**Pakete** (\`@uwe/*\` aus \`apps/${area.app}/package.json\`, ${packages.length})`,
    "",
    packages.map((name) => `\`${name}\``).join(" · "),
  ].join("\n");
}

/** Alle generierten Blöcke. Rein lesend — der Test vergleicht damit. */
export function renderAreaBlocks(): GeneratedBlock[] {
  return AREAS.flatMap((area) => [
    { file: `.claude/skills/${area.id}/SKILL.md`, id: "mcp", body: renderMcpBlock(area) },
    {
      file: `.claude/skills/${area.id}/references/karte.md`,
      id: "karte",
      body: renderKarteBlock(area),
    },
  ]);
}

// ---------------------------------------------------------------------------
// Marker
// ---------------------------------------------------------------------------

export function markerStart(id: string): string {
  return `<!-- uwe:generated:${id} start -->`;
}

export function markerEnd(id: string): string {
  return `<!-- uwe:generated:${id} end -->`;
}

/** Liest den aktuellen Inhalt zwischen den Markern. Wirft, wenn sie fehlen. */
export function readBlock(source: string, id: string, file: string): string {
  const start = source.indexOf(markerStart(id));
  const end = source.indexOf(markerEnd(id));
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `${file}: Marker \`uwe:generated:${id}\` fehlt oder ist verdreht. ` +
        "Ohne Marker weiß der Generator nicht, wohin — Datei von Hand reparieren.",
    );
  }
  return source.slice(start + markerStart(id).length, end).replace(/^\n|\n$/g, "");
}

export function writeBlock(source: string, id: string, body: string, file: string): string {
  const start = source.indexOf(markerStart(id));
  const end = source.indexOf(markerEnd(id));
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${file}: Marker \`uwe:generated:${id}\` fehlt oder ist verdreht.`);
  }
  return `${source.slice(0, start + markerStart(id).length)}\n${body}\n${source.slice(end)}`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const changed: string[] = [];

  for (const block of renderAreaBlocks()) {
    const absolute = path.join(root, block.file);
    const before = fs.readFileSync(absolute, "utf8");
    const after = writeBlock(before, block.id, block.body, block.file);
    if (before !== after) {
      fs.writeFileSync(absolute, after);
      changed.push(`${block.file} (${block.id})`);
    }
  }

  if (changed.length === 0) {
    console.log("skills:sync: alle Bereichs-Skills sind aktuell");
    return;
  }

  console.log(`skills:sync: ${changed.length} Block/Blöcke aktualisiert:`);
  for (const entry of changed) {
    console.log(`- ${entry}`);
  }
  console.log("Prosa-Teile der betroffenen Skills prüfen — die schreibt der Generator nicht.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
