"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@uwe/database/server";
import { createPlayerQuestionService } from "@uwe/database/player-questions";
import { notifyPlayerQuestionAnswered } from "@uwe/database/player-question-notify";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

const MAX_ANSWER_LENGTH = 4000;

function questionsPath(worldSlug: string) {
  return `/worlds/${worldSlug}/questions`;
}

/** DM beantwortet eine Spielerfrage. */
export async function answerPlayerQuestionAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();

  if (!worldSlug || !questionId) {
    throw new Error("Frage oder Welt fehlt.");
  }
  if (answer.length === 0) {
    throw new Error("Antwort darf nicht leer sein.");
  }
  if (answer.length > MAX_ANSWER_LENGTH) {
    throw new Error("Antwort ist zu lang.");
  }

  await requireStudioWorldEdit(worldSlug);

  const db = createPrismaClient();
  try {
    const service = createPlayerQuestionService(db);
    const updated = await service.answer(questionId, answer);

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });
    if (world) {
      await notifyPlayerQuestionAnswered(db, {
        questionId,
        worldName: world.name,
        worldSlug,
        answer,
      });
    }

    void updated;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(questionsPath(worldSlug));
}

/** DM archiviert eine Spielerfrage (Duplikat / off-topic). */
export async function archivePlayerQuestionAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const questionId = String(formData.get("questionId") ?? "").trim();

  if (!worldSlug || !questionId) {
    throw new Error("Frage oder Welt fehlt.");
  }

  await requireStudioWorldEdit(worldSlug);

  const db = createPrismaClient();
  try {
    const service = createPlayerQuestionService(db);
    await service.archive(questionId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(questionsPath(worldSlug));
}
