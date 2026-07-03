import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createKnowledgeAssistantService,
  synthesizeKnowledgeAnswer,
  type ConfidenceLevel,
  type KnowledgeSynthesisResult,
} from "@uwe/database/knowledge-assistant";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";

interface Props {
  searchParams: Promise<{ q?: string; synth?: string }>;
}

export const dynamic = "force-dynamic";

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  high: "#2e7d32",
  medium: "#b7791f",
  low: "#b7791f",
  none: "#c62828",
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "Gut belegt",
  medium: "Teilweise belegt",
  low: "Unsicher",
  none: "Unbekannt",
};

export default async function KnowledgePage({ searchParams }: Props) {
  await requireStudioAccess();
  const { q, synth } = await searchParams;
  const query = (q ?? "").trim();
  const answer = query ? await createKnowledgeAssistantService(prisma).ask(query) : null;
  const synthesis: KnowledgeSynthesisResult | null =
    answer && synth === "1" ? await synthesizeKnowledgeAnswer(prisma, answer) : null;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Wissensassistent" }]} />}>
      <PageHeader
        title="Wissensassistent"
        summary={`Fragt dein Life-Brain — mit Quellenpflicht: jede Antwort zeigt Quellen und Unsicherheit („das weiß ich nicht sicher“, „stammt aus alter Notiz“). Nur lokal, nie Cloud.`}
      />

      <section className="uwe-v2-section">
        <form method="get" style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Was möchtest du wissen?"
            style={{ flex: 1 }}
          />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Fragen
          </button>
        </form>
      </section>

      {answer ? (
        <>
          <section className="uwe-v2-section">
            <p style={{ color: CONFIDENCE_COLOR[answer.confidence], fontWeight: 600 }}>
              ● {CONFIDENCE_LABEL[answer.confidence]}
            </p>
            <p>{answer.note}</p>
          </section>

          {answer.citations.length > 0 ? (
            <section className="uwe-v2-section">
              <h2 className="uwe-v2-section-title">KI-Antwort (lokal, geerdet)</h2>
              {synthesis?.status === "ok" ? (
                <>
                  <p style={{ whiteSpace: "pre-wrap" }}>{synthesis.text}</p>
                  <p className="uwe-hint">
                    Lokal formuliert (RTX), erdet auf den Quellen unten — die Quellen
                    bleiben maßgeblich.
                  </p>
                </>
              ) : synthesis ? (
                <p className="uwe-notice-warn">{synthesis.error}</p>
              ) : (
                <form method="get" className="uwe-inline-actions">
                  <input type="hidden" name="q" value={query} />
                  <input type="hidden" name="synth" value="1" />
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
                    KI-Antwort formulieren (RTX-lokal)
                  </button>
                </form>
              )}
            </section>
          ) : null}

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Quellen</h2>
            {answer.citations.length === 0 ? (
              <p className="uwe-dashboard-muted">
                Keine passenden Quellen im Life-Brain. Vielleicht als{" "}
                <Link href="/capture">Capture</Link> festhalten?
              </p>
            ) : (
              <ul className="uwe-linked-list">
                {answer.citations.map((cite) => {
                  const href =
                    cite.kind === "document"
                      ? `/life-brain/documents/${cite.id}`
                      : `/life-brain/facts/${cite.id}`;
                  return (
                    <li key={`${cite.kind}-${cite.id}`}>
                      <Link href={href}>{cite.title}</Link>{" "}
                      <span className="uwe-badge">{cite.sourceType}</span>
                      {cite.ageNote ? (
                        <span className="uwe-dashboard-muted"> · {cite.ageNote}</span>
                      ) : null}
                      <p className="uwe-dashboard-muted">{cite.snippet}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="uwe-dashboard-muted">
          Stell eine Frage — die Antwort kommt ausschließlich aus deinem lokalen Life-Brain.
        </p>
      )}
    </StudioShell>
  );
}
