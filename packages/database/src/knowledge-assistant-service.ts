import type { PrismaClient } from "./client";
import { createLifeAdminService } from "./life-admin-service";
import type {
  PersonalBrainSearchHit,
  PersonalBrainSearchResult,
  PersonalBrainSearchableDoc,
  PersonalBrainSearchableFact,
} from "./personal-brain-search";

/**
 * Wissensassistent mit Quellenpflicht: beantwortet eine Frage aus dem Life-Brain
 * und weist IMMER Quellen + Unsicherheit aus („das weiß ich nicht sicher",
 * „stammt aus alter Notiz"). Reines Retrieval über das lokale Brain — keine
 * Cloud, kein Dispatch. Eine spätere RTX-lokale LLM-Synthese kann darauf
 * aufsetzen (personal_brain-Modus), ersetzt die Quellen aber nie.
 */

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface KnowledgeCitation {
  id: string;
  kind: "document" | "fact";
  title: string;
  snippet: string;
  sourceType: string;
  score: number;
  ageNote: string | null;
}

export interface KnowledgeAnswer {
  query: string;
  confidence: ConfidenceLevel;
  note: string;
  citations: KnowledgeCitation[];
}

const CONFIDENCE_NOTES: Record<ConfidenceLevel, string> = {
  high: "Gut belegt durch das Life-Brain.",
  medium: "Teilweise belegt — bitte gegenprüfen.",
  low: "Nur schwache Treffer — unsicher.",
  none: "Das weiß ich nicht sicher — keine passende Quelle im Life-Brain.",
};

const STALE_MONTHS = 12;

/** Konfidenz aus Top-Score + Trefferzahl. Pure. */
export function assessConfidence(result: PersonalBrainSearchResult): ConfidenceLevel {
  const scores = [
    ...result.documents.map((hit) => hit.score),
    ...result.facts.map((hit) => hit.score),
  ];
  if (scores.length === 0) return "none";
  const top = Math.max(...scores);
  if (top >= 0.6) return "high";
  if (top >= 0.35) return "medium";
  return "low";
}

/** „stammt aus alter Notiz", wenn die Quelle älter als STALE_MONTHS ist. Pure. */
export function sourceAgeNote(updatedAt: Date | undefined, now: Date): string | null {
  if (!updatedAt) return null;
  const months = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months >= STALE_MONTHS ? "stammt aus einer älteren Notiz" : null;
}

function snippet(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
}

/** Führt Dok-/Fakt-Treffer zu einer nach Score sortierten Zitatliste zusammen. Pure. */
export function buildCitations(
  result: PersonalBrainSearchResult,
  now: Date,
  limit = 6,
): KnowledgeCitation[] {
  const docCitations = result.documents.map(
    (hit: PersonalBrainSearchHit<PersonalBrainSearchableDoc>): KnowledgeCitation => ({
      id: hit.item.id,
      kind: "document",
      title: hit.item.title,
      snippet: snippet(hit.item.content),
      sourceType: hit.item.category?.trim() || "Dokument",
      score: hit.score,
      ageNote: sourceAgeNote(hit.item.updatedAt, now),
    }),
  );
  const factCitations = result.facts.map(
    (hit: PersonalBrainSearchHit<PersonalBrainSearchableFact>): KnowledgeCitation => ({
      id: hit.item.id,
      kind: "fact",
      title: hit.item.title,
      snippet: snippet(hit.item.content),
      sourceType: hit.item.factType || "Fakt",
      score: hit.score,
      ageNote: sourceAgeNote(hit.item.updatedAt, now),
    }),
  );

  return [...docCitations, ...factCitations]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Baut die vollständige Antwort inkl. Quellen + Unsicherheit. Pure. */
export function buildKnowledgeAnswer(
  query: string,
  result: PersonalBrainSearchResult,
  now: Date,
): KnowledgeAnswer {
  const confidence = assessConfidence(result);
  return {
    query,
    confidence,
    note: CONFIDENCE_NOTES[confidence],
    citations: buildCitations(result, now),
  };
}

export class KnowledgeAssistantService {
  constructor(private readonly db: PrismaClient) {}

  async ask(query: string, now: Date = new Date()): Promise<KnowledgeAnswer> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { query: "", confidence: "none", note: CONFIDENCE_NOTES.none, citations: [] };
    }
    const result = await createLifeAdminService(this.db).searchPersonalBrain({
      query: trimmed,
      limit: 8,
    });
    return buildKnowledgeAnswer(trimmed, result, now);
  }
}

export function createKnowledgeAssistantService(db: PrismaClient): KnowledgeAssistantService {
  return new KnowledgeAssistantService(db);
}

export {
  buildSynthesisPrompt,
  synthesizeKnowledgeAnswer,
  type KnowledgeSynthesisResult,
} from "./knowledge-synthesis";
