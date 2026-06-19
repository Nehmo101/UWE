"use server";

import { mustSubmitProposal } from "@uwe/auth";
import { createCoDmChangeReview, createPrismaClient } from "@uwe/database/server";
import { getCurrentUser } from "@/src/lib/auth";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldRead } from "@/src/lib/authz";

export interface SubmitCoDmChangeInput {
  worldId: string;
  worldSlug: string;
  pageId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  diff?: Record<string, unknown>;
  targetHref?: string;
}

export async function submitCoDmChangeAction(input: SubmitCoDmChangeInput) {
  await requireStudioActionAuth();
  await requireStudioWorldRead(input.worldSlug);

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Anmeldung erforderlich." };
  }

  const db = createPrismaClient();
  try {
    const membership = await db.worldMembership.findUnique({
      where: { userId_worldId: { userId: user.id, worldId: input.worldId } },
    });

    const ctx = {
      user,
      worldMembership: membership
        ? {
            userId: membership.userId,
            worldId: membership.worldId,
            role: membership.role,
            characterName: membership.characterName,
          }
        : null,
    };

    if (!mustSubmitProposal(ctx) && membership?.role !== "co_dm") {
      return {
        ok: false,
        message: "Direkte Bearbeitung möglich — kein Review-Vorschlag nötig.",
      };
    }

    const review = await createCoDmChangeReview(db, {
      worldId: input.worldId,
      worldSlug: input.worldSlug,
      proposedByUserId: user.id,
      title: input.title,
      summary: input.summary,
      payload: {
        pageId: input.pageId,
        ...input.payload,
      },
      diff: input.diff,
      targetHref: input.targetHref,
    });

    return { ok: true, reviewId: review.id, message: "Änderungsvorschlag eingereicht." };
  } finally {
    await db.$disconnect();
  }
}
