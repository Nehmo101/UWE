import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DevIdeaLifecycle, DevIdeaType } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { createDevIdeaService } from "./dev-idea-service";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export interface FeatureMatrixRow {
  number: number;
  title: string;
  overallStatus: string;
  usable: string;
  productionReady: string;
}

export interface FeatureMatrixUpsertCandidate {
  title: string;
  ideaType: DevIdeaType;
  module: string;
  maturityLevel: string;
  lifecycle: DevIdeaLifecycle;
  body: string;
  metadata: Record<string, unknown>;
}

export interface FeatureMatrixSyncResult {
  created: number;
  updated: number;
  total: number;
  titles: string[];
}

/** Curated module + maturity per overview row (see docs/FEATURE_MATURITY_MATRIX.md).
 *  #4 (Agent Jobs) ist entfallen — die Nummerierung hat dort bewusst eine Lücke. */
export const FEATURE_MATRIX_ENRICHMENT: Record<
  number,
  { module: string; maturityLevel: string }
> = {
  1: { module: "media", maturityLevel: "lab" },
  2: { module: "integrations", maturityLevel: "beta" },
  3: { module: "dnd", maturityLevel: "stable" },
  5: { module: "daily_admin", maturityLevel: "beta" },
  6: { module: "studio", maturityLevel: "beta" },
  7: { module: "auth", maturityLevel: "stable" },
  8: { module: "dnd", maturityLevel: "beta" },
  9: { module: "generators", maturityLevel: "beta" },
  10: { module: "studio", maturityLevel: "stable" },
  11: { module: "hosting", maturityLevel: "lab" },
  12: { module: "media", maturityLevel: "stable" },
  13: { module: "studio", maturityLevel: "beta" },
  14: { module: "studio", maturityLevel: "stable" },
  15: { module: "hosting", maturityLevel: "stable" },
};

export function maturityToLifecycle(maturityLevel: string): DevIdeaLifecycle {
  if (maturityLevel === "stable") return "existing";
  if (maturityLevel === "deprecated") return "deprecated";
  return "planned";
}

/** Parse the „Übersicht“ table (features 1–15) from FEATURE_MATURITY_MATRIX.md. */
export function parseFeatureMatrixOverviewTable(markdown: string): FeatureMatrixRow[] {
  const lines = markdown.split(/\r?\n/);
  const rows: FeatureMatrixRow[] = [];
  let inOverview = false;

  for (const line of lines) {
    if (line.startsWith("## Übersicht")) {
      inOverview = true;
      continue;
    }
    if (inOverview && line.startsWith("## ") && !line.startsWith("## Übersicht")) {
      break;
    }
    if (!inOverview) continue;

    /* Von Hand aufgeteilt statt per Regex. Der frühere Ausdruck
       `^\|\s*(\d+)\s*\|\s*(.+?)\s*\|…` stellte pro Zelle ein `\s*` neben ein
       `.+?` — und `.` schließt Leerraum ein. Bei einer Zeile aus vielen
       Leerzeichen probierte der Backtracker jede Kombination der Zellgrenzen
       durch: bei drei solchen Zellen kubische Laufzeit, ab etwa 800 Zeichen
       schon über eine Sekunde. Aufteilen ist linear und liest sich besser;
       `.trim()` stand ohnehin schon an jeder Zelle. */
    const cells = line.split("|");
    // "| a | b | c | d | e |" ergibt zwei leere Randfelder plus fünf Zellen.
    if (cells.length !== 7) continue;
    if (cells[0]!.trim() !== "" || cells[6]!.trim() !== "") continue;

    // Nur reine Ziffern, wie zuvor `(\d+)` — so fallen Kopf- und Trennzeile raus.
    const numberCell = cells[1]!.trim();
    if (!/^\d+$/.test(numberCell)) continue;
    const number = Number(numberCell);
    if (!Number.isInteger(number) || number < 1 || number > 15) continue;

    const title = cells[2]!.trim();
    const overallStatus = cells[3]!.trim();
    const usable = cells[4]!.trim();
    const productionReady = cells[5]!.trim();
    if (!title || !overallStatus || !usable || !productionReady) continue;

    rows.push({ number, title, overallStatus, usable, productionReady });
  }

  return rows.sort((a, b) => a.number - b.number);
}

export function rowToUpsertCandidate(row: FeatureMatrixRow): FeatureMatrixUpsertCandidate {
  const enrichment = FEATURE_MATRIX_ENRICHMENT[row.number];
  if (!enrichment) {
    throw new Error(`Keine Enrichment-Daten für Feature #${row.number} (${row.title}).`);
  }

  const lifecycle = maturityToLifecycle(enrichment.maturityLevel);

  return {
    title: row.title,
    ideaType: "feature",
    module: enrichment.module,
    maturityLevel: enrichment.maturityLevel,
    lifecycle,
    body: [
      `Quelle: FEATURE_MATURITY_MATRIX.md (#${row.number}).`,
      `Gesamtstatus: ${row.overallStatus}.`,
      `Nutzbar: ${row.usable}.`,
      `Production-ready: ${row.productionReady}.`,
    ].join(" "),
    metadata: {
      source: "feature_maturity_matrix",
      matrixNumber: row.number,
      overallStatus: row.overallStatus,
      usable: row.usable,
      productionReady: row.productionReady,
    },
  };
}

export function parseFeatureMatrixUpsertCandidates(markdown: string): FeatureMatrixUpsertCandidate[] {
  return parseFeatureMatrixOverviewTable(markdown).map(rowToUpsertCandidate);
}

export function resolveFeatureMatrixPath(customPath?: string): string {
  if (customPath) return customPath;
  const candidates = [
    join(moduleDir, "..", "..", "..", "docs", "FEATURE_MATURITY_MATRIX.md"),
    join(process.cwd(), "docs", "FEATURE_MATURITY_MATRIX.md"),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // try next
    }
  }
  return candidates[0]!;
}

export function loadFeatureMatrixMarkdown(matrixPath?: string): string {
  const resolved = resolveFeatureMatrixPath(matrixPath);
  return readFileSync(resolved, "utf8");
}

export async function syncFeatureMatrixToDevIdeas(
  db: PrismaClient,
  options: { matrixPath?: string; matrixMarkdown?: string } = {},
): Promise<FeatureMatrixSyncResult> {
  const markdown =
    options.matrixMarkdown ??
    loadFeatureMatrixMarkdown(options.matrixPath);
  const candidates = parseFeatureMatrixUpsertCandidates(markdown);
  const ideas = createDevIdeaService(db);

  let created = 0;
  let updated = 0;
  const titles: string[] = [];

  for (const candidate of candidates) {
    titles.push(candidate.title);
    const existing = await db.devIdea.findFirst({
      where: { title: candidate.title, ideaType: "feature" },
    });

    if (existing) {
      await ideas.updateIdea(existing.id, {
        module: candidate.module,
        maturityLevel: candidate.maturityLevel,
        lifecycle: candidate.lifecycle,
        ideaType: candidate.ideaType,
        metadata: candidate.metadata,
        ...(existing.body.trim() ? {} : { body: candidate.body }),
      });
      updated += 1;
    } else {
      await ideas.createIdea({
        title: candidate.title,
        body: candidate.body,
        ideaType: candidate.ideaType,
        lifecycle: candidate.lifecycle,
        module: candidate.module,
        maturityLevel: candidate.maturityLevel,
        metadata: candidate.metadata,
      });
      created += 1;
    }
  }

  return { created, updated, total: candidates.length, titles };
}
