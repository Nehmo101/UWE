import { notFound } from "next/navigation";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import { askPlayerQuestionAction } from "@/app/question-actions";
import { PageHeader } from "@/src/components/shell";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/input";
import { Alert } from "@/src/components/ui/states";
import {
  PLAYER_QUESTION_STATUS_LABELS,
  createPlayerQuestionService,
  type PlayerQuestionView,
} from "@uwe/database/player-questions";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";

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

  const db = getSharedPrismaClient();
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
    await disconnectPrismaClientIfOwned(db);
  }

  const visible = questions.filter((question) => question.status !== "archived");
  const canAsk = Boolean(user && !ctx.previewAsUserId);

  return (
    <>
      <PageHeader
        title="Fragen an den DM"
        summary="Stell zwischen den Runden deine Fragen an den Spielleiter — die Antworten erscheinen hier, sobald der DM sie beantwortet hat."
      />

      <div className="grid gap-4">
        {canAsk ? (
          <Card>
            <CardHeader>
              <CardTitle>Neue Frage stellen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={askPlayerQuestionAction} className="grid gap-4">
                <input type="hidden" name="worldSlug" value={worldSlug} />
                <div className="grid gap-1.5">
                  <Label htmlFor="question">Deine Frage</Label>
                  <Textarea
                    id="question"
                    name="question"
                    rows={3}
                    required
                    maxLength={2000}
                    placeholder="Was möchtest du den DM fragen?"
                  />
                </div>
                <div>
                  <Button type="submit">Frage absenden</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            Melde dich an, um dem Spielleiter eine Frage zu stellen.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fragen &amp; Antworten</CardTitle>
          </CardHeader>
          <CardContent>
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Fragen gestellt.</p>
            ) : (
              <ul className="grid gap-3">
                {visible.map((question) => (
                  <li
                    key={question.id}
                    className="rounded-[var(--radius)] border border-border p-4"
                  >
                    <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <strong>{question.authorName}</strong>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(question.createdAt)}
                      </span>
                    </header>
                    <p className="whitespace-pre-wrap text-sm">{question.question}</p>
                    {question.status === "answered" && question.answer ? (
                      <Alert tone="info" title="Antwort des DM" className="mt-2">
                        <p className="whitespace-pre-wrap text-foreground">{question.answer}</p>
                        {question.answeredAt ? (
                          <p className="mt-1 text-xs">{formatDate(question.answeredAt)}</p>
                        ) : null}
                      </Alert>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {PLAYER_QUESTION_STATUS_LABELS[question.status]} — wartet auf den DM.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
