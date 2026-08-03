import type { BrainPrismaClient as PrismaClient } from "./brain-client";
// Die Family-Modelle (Vertraege, Dokumente, Kueche, Haushalt, Kalender,
// Scan-Eingang) liegen seit Abschnitt G in uwe-family.db. Der Singleton als
// Vorgabewert statt eines Pflicht-Parameters: sonst muesste jede Aufrufstelle
// im Repo einen dritten Client durchreichen. Tests reichen ihn explizit rein.
import { familyPrisma, type FamilyPrismaClient } from "./family-client";

/**
 * „Mach weiter wo ich aufgehört habe"-Zentrale: aggregiert die wahrscheinlich
 * relevanten Fortsetzungen (offene Projekte mit nächster Aktion, Werkstatt-
 * Aufgaben, unbearbeitete Captures, wartende Scans) zu einer kurzen Liste.
 * Read-only, aus vorhandenen Daten abgeleitet.
 */

export type ContinuationKind = "project" | "workshop" | "capture" | "scan";

export interface Continuation {
  id: string;
  kind: ContinuationKind;
  title: string;
  hint: string;
  href: string;
  /** Sortierdatum (jüngste Aktivität zuerst). */
  sortDate: Date;
}

const KIND_LABELS: Record<ContinuationKind, string> = {
  project: "Projekt",
  workshop: "Werkstatt",
  capture: "Capture",
  scan: "Scan",
};

export function continuationKindLabel(kind: ContinuationKind): string {
  return KIND_LABELS[kind];
}

/** Pure: nach Aktualität sortieren und auf `limit` kürzen. */
export function rankContinuations(items: Continuation[], limit = 5): Continuation[] {
  return [...items]
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
    .slice(0, limit);
}

function preview(text: string | null | undefined, fallback: string): string {
  const trimmed = text?.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

export class ContinueWorkService {
  constructor(
    private readonly db: PrismaClient,
    private readonly familyDb: FamilyPrismaClient = familyPrisma,
  ) {}

  async getContinuations(limit = 5): Promise<Continuation[]> {
    const perSource = Math.max(limit, 5);
    const [projects, workshops, captures, scans] = await Promise.all([
      this.db.personalProject.findMany({
        where: { nextAction: { not: null }, status: { notIn: ["done", "archived"] } },
        orderBy: [{ updatedAt: "desc" }],
        take: perSource,
        select: { id: true, name: true, nextAction: true, updatedAt: true },
      }),
      this.db.workshopProject.findMany({
        where: { nextAction: { not: null }, status: { notIn: ["done", "archived"] } },
        orderBy: [{ updatedAt: "desc" }],
        take: perSource,
        select: { id: true, title: true, nextAction: true, updatedAt: true },
      }),
      this.db.captureEntry.findMany({
        where: { status: { notIn: ["archived", "linked"] } },
        orderBy: [{ capturedAt: "desc" }],
        take: perSource,
        select: { id: true, title: true, content: true, capturedAt: true },
      }),
      this.familyDb.scanDocument.findMany({
        where: {
          status: {
            notIn: ["filed", "rejected", "archived", "unanalyzed", "analyzing"],
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: perSource,
        select: { id: true, title: true, updatedAt: true, status: true },
      }),
    ]);

    const items: Continuation[] = [];

    for (const project of projects) {
      if (!project.nextAction?.trim()) continue;
      items.push({
        id: project.id,
        kind: "project",
        title: project.name,
        hint: preview(project.nextAction, "Nächster Schritt offen"),
        href: "/projects",
        sortDate: project.updatedAt,
      });
    }

    for (const workshop of workshops) {
      if (!workshop.nextAction?.trim()) continue;
      items.push({
        id: workshop.id,
        kind: "workshop",
        title: workshop.title,
        hint: preview(workshop.nextAction, "Nächster Schritt offen"),
        href: "/workshop",
        sortDate: workshop.updatedAt,
      });
    }

    for (const capture of captures) {
      items.push({
        id: capture.id,
        kind: "capture",
        title: capture.title || "Notiz",
        hint: preview(capture.content, "Capture noch nicht triagiert"),
        href: `/capture/${capture.id}`,
        sortDate: capture.capturedAt,
      });
    }

    for (const scan of scans) {
      items.push({
        id: scan.id,
        kind: "scan",
        title: scan.title || "Dokument",
        hint: scan.status === "waiting_for_engine" ? "Wartet auf Maschinenraum" : "Vorschlag prüfen",
        href: `/scan-inbox/${scan.id}`,
        sortDate: scan.updatedAt,
      });
    }

    return rankContinuations(items, limit);
  }
}

export function createContinueWorkService(
  db: PrismaClient,
  familyDb: FamilyPrismaClient = familyPrisma,
): ContinueWorkService {
  return new ContinueWorkService(db, familyDb);
}
