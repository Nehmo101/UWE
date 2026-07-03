import { notFound } from "next/navigation";
import { createPrismaClient, getAppRepository } from "@uwe/database/server";
import {
  createPlayerQuestionService,
  PLAYER_QUESTION_STATUS_LABELS,
  type PlayerQuestionView,
} from "@uwe/database/player-questions";
import {
  answerPlayerQuestionAction,
  archivePlayerQuestionAction,
} from "../questions-actions";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function StudioPlayerQuestionsPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  let questions: PlayerQuestionView[] = [];
  try {
    const service = createPlayerQuestionService(db);
    questions = await service.listForWorld(worldSlug);
  } finally {
    await db.$disconnect();
  }

  const open = questions.filter((question) => question.status === "open");
  const answered = questions.filter((question) => question.status === "answered");

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(
            world.name,
            worldSlug,
            "Spielerfragen",
            `/worlds/${worldSlug}/questions`,
          )}
        />
      }
    >
      <PageHeader
        title="Fragen an den DM"
        summary="Fragen, die deine Spieler im Portal gestellt haben — beantworte sie hier oder archiviere sie."
      />

      <section className="uwe-block">
        <h2>Offen ({open.length})</h2>
        {open.length === 0 ? (
          <p className="uwe-v2-empty">Keine offenen Fragen.</p>
        ) : (
          <div className="uwe-notes-queue">
            {open.map((question) => (
              <article key={question.id} className="uwe-note-card">
                <header className="uwe-note-card-header">
                  <div>
                    <strong>{question.authorName}</strong>
                    <span className="uwe-note-meta">{formatDate(question.createdAt)}</span>
                  </div>
                </header>
                <p className="uwe-note-card-content">{question.question}</p>
                <footer className="uwe-note-card-actions">
                  <form action={answerPlayerQuestionAction} className="uwe-note-adopt-page">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <textarea
                      name="answer"
                      rows={2}
                      required
                      maxLength={4000}
                      placeholder="Antwort an die Gruppe…"
                      className="uwe-input-inline"
                    />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm">
                      Antworten
                    </button>
                  </form>
                  <form action={archivePlayerQuestionAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                      Archivieren
                    </button>
                  </form>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="uwe-block">
        <h2>Beantwortet ({answered.length})</h2>
        {answered.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine beantworteten Fragen.</p>
        ) : (
          <div className="uwe-notes-queue">
            {answered.map((question) => (
              <article key={question.id} className="uwe-note-card">
                <header className="uwe-note-card-header">
                  <div>
                    <strong>{question.authorName}</strong>
                    <span className="uwe-note-meta">
                      {PLAYER_QUESTION_STATUS_LABELS[question.status]}
                      {question.answeredAt ? ` · ${formatDate(question.answeredAt)}` : ""}
                    </span>
                  </div>
                </header>
                <p className="uwe-note-card-content">{question.question}</p>
                {question.answer && (
                  <p className="uwe-note-card-content">
                    <strong>Antwort:</strong> {question.answer}
                  </p>
                )}
                <footer className="uwe-note-card-actions">
                  <form action={archivePlayerQuestionAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                      Archivieren
                    </button>
                  </form>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </WorldShell>
  );
}
