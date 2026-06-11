"use server";

import { revalidatePath } from "next/cache";
import {
  canCreatePlayerNote,
  canEditPlayerNote,
  canModeratePlayerNote,
} from "@uwe/auth";
import {
  createAuthService,
  createPrismaClient,
} from "@uwe/database/server";
import {
  getAccessContextForWorld,
  getCurrentUser,
} from "@/src/lib/auth";

async function getAuthContext(worldSlug: string) {
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }
  return { user, ctx };
}

export async function createPlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const campaignId = String(formData.get("campaignId"));
  const content = String(formData.get("content") || "").trim();
  const pageId = String(formData.get("pageId") || "") || null;
  const gameSessionId = String(formData.get("gameSessionId") || "") || null;
  const returnPath = String(formData.get("returnPath") || `/auth/worlds/${worldSlug}`);

  if (!content) {
    throw new Error("Notiz darf nicht leer sein");
  }

  const { ctx } = await getAuthContext(worldSlug);
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { guestCommentsEnabled: true },
    });
    if (!world || !canCreatePlayerNote(ctx, world.guestCommentsEnabled)) {
      throw new Error("Keine Berechtigung zum Kommentieren");
    }

    await auth.createPlayerNoteForViewer(worldSlug, ctx, {
      campaignId,
      content,
      pageId,
      gameSessionId,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
  revalidatePath(`/auth/worlds/${worldSlug}`);
}

export async function submitPlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));
  const returnPath = String(formData.get("returnPath") || `/auth/worlds/${worldSlug}`);

  const { ctx } = await getAuthContext(worldSlug);
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const note = await auth.getPlayerNoteService().getByIdForWorld(worldSlug, noteId);
    if (!note || !canEditPlayerNote(ctx, note)) {
      throw new Error("Keine Berechtigung");
    }

    await auth.submitPlayerNoteForViewer(worldSlug, noteId, ctx);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
}

export async function updatePlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));
  const content = String(formData.get("content") || "").trim();
  const returnPath = String(formData.get("returnPath") || `/auth/worlds/${worldSlug}`);

  if (!content) {
    throw new Error("Notiz darf nicht leer sein");
  }

  const { ctx } = await getAuthContext(worldSlug);
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const note = await auth.getPlayerNoteService().getByIdForWorld(worldSlug, noteId);
    if (!note || !canEditPlayerNote(ctx, note)) {
      throw new Error("Keine Berechtigung");
    }

    await auth.updatePlayerNoteForViewer(worldSlug, noteId, ctx, content);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(returnPath);
}
