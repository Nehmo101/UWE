import { notFound } from "next/navigation";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { askPlayerQuestionAction } from "@/app/question-actions";
import {
  PLAYER_QUESTION_STATUS_LABELS,
  createPlayerQuestionService,
  type PlayerQuestionView,
} from "@uwe/database/player-questions";
import { createPrismaClient } from "@uwe/database/server";

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

export default async function PortalQuestionsPage({ params }: Props) {
  const { worldSlug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  let questions: PlayerQuestionView[] = [];

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      notFound();
    }

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }

    const service = createPlayerQuestionService(db);
    questions = await service.listForWorld(worldSlug);
  } finally {
    await db.$disconnect();
  }

  // Archivierte Fragen sind für Spieler nicht relevant.
  const visible = questions.filter((question) => question.status !== "archived");
  const canAsk = Boolean(user && !ctx.previewAsUserId);

  return (
    <section className="portal-content-card">
      <h1>Fragen an den DM</h1>
      <p className="auth-lead">
        Stell zwischen den Runden deine Fragen an den Spielleiter — die Antworten
        erscheinen hier, sobald der DM sie beantwortet hat.
      </p>

      {canAsk ? (
        <section className="auth-block">
          <h2>Neue Frage stellen</h2>
          <form action={askPlayerQuestionAction} className="auth-note-form">
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <label>
              Deine Frage
              <textarea
                name="question"
                rows={3}
                required
                maxLength={2000}
                placeholder="Was möchtest du den DM fragen?"
              />
            </label>
            <button type="submit" className="auth-btn">
              Frage absenden
            </button>
          </form>
        </section>
      ) : (
        <p className="auth-muted">
          Melde dich an, um dem Spielleiter eine Frage zu stellen.
        </p>
      )}

      <section className="auth-block">
        <h2>Fragen &amp; Antworten</h2>
        {visible.length === 0 ? (
          <p className="auth-muted">Noch keine Fragen gestellt.</p>
        ) : (
          <ul className="auth-notes-list">
            {visible.map((question) => (
              <li key={question.id} className="auth-note-item">
                <header className="auth-note-header">
                  <strong>{question.authorName}</strong>
                  <span className="auth-muted">{formatDate(question.createdAt)}</span>
                </header>
                <p className="auth-note-content">{question.question}</p>
                {question.status === "answered" && question.answer ? (
                  <div className="portal-dash-highlight" style={{ marginTop: "0.5rem" }}>
                    <strong>Antwort des DM</strong>
                    <p className="auth-note-content">{question.answer}</p>
                    {question.answeredAt && (
                      <p className="auth-muted">{formatDate(question.answeredAt)}</p>
                    )}
                  </div>
                ) : (
                  <p className="auth-muted">
                    {PLAYER_QUESTION_STATUS_LABELS[question.status]} — wartet auf den DM.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
