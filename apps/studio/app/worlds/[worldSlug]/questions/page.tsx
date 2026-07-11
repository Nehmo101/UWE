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
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  EmptyState,
  Textarea,
} from "@/src/components/ui";

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
        meta={open.length > 0 ? <Badge variant="warning">{open.length} neu</Badge> : undefined}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Offen ({open.length})</h2>
        {open.length === 0 ? (
          <EmptyState title="Keine offenen Fragen." />
        ) : (
          <div className="flex flex-col gap-4">
            {open.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <strong>{question.authorName}</strong>
                  <span className="text-sm text-muted-foreground">{formatDate(question.createdAt)}</span>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{question.question}</p>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-2">
                  <form action={answerPlayerQuestionAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <Textarea
                      name="answer"
                      rows={2}
                      required
                      maxLength={4000}
                      placeholder="Antwort an die Gruppe…"
                      className="min-h-9 w-64"
                    />
                    <Button type="submit" size="sm">
                      Antworten
                    </Button>
                  </form>
                  <form action={archivePlayerQuestionAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Archivieren
                    </Button>
                  </form>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Beantwortet ({answered.length})</h2>
        {answered.length === 0 ? (
          <EmptyState title="Noch keine beantworteten Fragen." />
        ) : (
          <div className="flex flex-col gap-4">
            {answered.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <strong>{question.authorName}</strong>
                  <span className="text-sm text-muted-foreground">
                    {PLAYER_QUESTION_STATUS_LABELS[question.status]}
                    {question.answeredAt ? ` · ${formatDate(question.answeredAt)}` : ""}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{question.question}</p>
                  {question.answer && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      <strong>Antwort:</strong> {question.answer}
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <form action={archivePlayerQuestionAction}>
                    <input type="hidden" name="worldSlug" value={worldSlug} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Archivieren
                    </Button>
                  </form>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </WorldShell>
  );
}
