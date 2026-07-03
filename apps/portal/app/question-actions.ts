"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@uwe/database/server";
import { createPlayerQuestionService } from "@uwe/database/player-questions";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

const MAX_QUESTION_LENGTH = 2000;

/**
 * Spieler stellt eine Frage an den DM. Business-Logik im Service —
 * hier nur Auth, Eingabe-Validierung und Revalidierung.
 */
export async function askPlayerQuestionAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();

  if (!worldSlug) {
    throw new Error("Welt fehlt.");
  }
  if (question.length === 0) {
    throw new Error("Frage darf nicht leer sein.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new Error("Frage ist zu lang.");
  }

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden");
    }
    assertPortalCanReadWorld(ctx, world.id);

    const authorName =
      ctx.worldMembership?.characterName?.trim() || user.displayName || "Spieler";

    const service = createPlayerQuestionService(db);
    await service.ask({
      worldSlug,
      authorUserId: user.id,
      authorName,
      question,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/auth/worlds/${worldSlug}/questions`);
  revalidatePath(`/auth/worlds/${worldSlug}`);
}
