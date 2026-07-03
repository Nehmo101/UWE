"use server";

import { revalidatePath } from "next/cache";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import {
  createQuestFlagService,
  createSessionAvailabilityService,
  normalizeAvailabilityStatus,
  normalizeQuestPriority,
} from "@uwe/player-hub";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

/**
 * Schreibzugriff nur für echte angemeldete Nutzer — im Preview-as-Player-Modus
 * würde der DM sonst unter eigener ID im Namen des Spielers abstimmen.
 */
async function requireWritableViewer(worldSlug: string) {
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx?.user) {
    throw new Error("Nicht angemeldet.");
  }
  if (ctx.previewAsUserId) {
    throw new Error("Im Vorschau-Modus sind keine Änderungen möglich.");
  }

  const db = createPrismaClient();
  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }
    assertPortalCanReadWorld(ctx, world.id);
  } finally {
    await db.$disconnect();
  }

  return ctx;
}

export async function setQuestPriorityAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  const priority = normalizeQuestPriority(String(formData.get("priority")));

  const ctx = await requireWritableViewer(worldSlug);

  const db = createPrismaClient();
  try {
    // Nur Quests flaggen, die für den Viewer sichtbar sind.
    const auth = createAuthService(db);
    const pages = await auth.listPagesForViewer(worldSlug, ctx);
    const quest = pages.find((page) => page.id === pageId && page.type === "quest");
    if (!quest) {
      throw new Error("Quest nicht gefunden oder nicht freigeschaltet.");
    }

    await createQuestFlagService(db).upsert({
      pageId,
      userId: ctx.user!.id,
      priority,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/auth/worlds/${worldSlug}/quests`);
}

export async function setSessionAvailabilityAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  const status = normalizeAvailabilityStatus(String(formData.get("status")));
  if (!status) {
    throw new Error("Ungültiger Verfügbarkeits-Status.");
  }

  const ctx = await requireWritableViewer(worldSlug);

  const db = createPrismaClient();
  try {
    // Nur für Sessions abstimmen, die der Viewer sehen darf.
    const auth = createAuthService(db);
    const session = await auth.getGameSessionForViewer(worldSlug, sessionId, ctx);
    if (!session) {
      throw new Error("Session nicht gefunden oder nicht sichtbar.");
    }

    await createSessionAvailabilityService(db).upsertVote({
      sessionId,
      userId: ctx.user!.id,
      status,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/auth/worlds/${worldSlug}/sessions`);
}
