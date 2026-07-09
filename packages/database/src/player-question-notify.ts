import type { PrismaClient } from "./client";
import { createMailService } from "./mail-service";

/**
 * Best-effort mail notification when a DM answers a player question.
 * Skips silently when mail is disabled or the author has no email.
 */
export async function notifyPlayerQuestionAnswered(
  db: PrismaClient,
  input: {
    questionId: string;
    worldName: string;
    worldSlug: string;
    answer: string;
  },
): Promise<{ sent: boolean; error?: string }> {
  const question = await db.playerQuestion.findUnique({
    where: { id: input.questionId },
    select: {
      question: true,
      authorUserId: true,
      authorName: true,
      worldId: true,
    },
  });
  if (!question?.authorUserId) {
    return { sent: false };
  }

  const user = await db.user.findUnique({
    where: { id: question.authorUserId },
    select: { email: true, displayName: true },
  });
  const email = user?.email?.trim();
  if (!email) {
    return { sent: false };
  }

  const subject = `Antwort auf deine Frage — ${input.worldName}`;
  const bodyText = [
    `Hallo ${question.authorName || user?.displayName || "Spieler"},`,
    "",
    `Der DM hat deine Frage beantwortet:`,
    "",
    question.question,
    "",
    "Antwort:",
    input.answer,
    "",
    `Im Portal: /auth/worlds/${input.worldSlug}/questions`,
  ].join("\n");

  const result = await createMailService(db).sendMail({
    to: [{ email, name: question.authorName || user?.displayName || "Spieler" }],
    subject,
    bodyText,
    worldId: question.worldId,
    sourceType: "player_question_answer",
    sourceId: input.questionId,
  });

  return { sent: result.ok, error: result.error };
}
