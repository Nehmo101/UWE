"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import {
  canCreatePlayerNote,
  canEditPlayerNote,
} from "@uwe/auth";
import {
  createAuthService,
  createPrismaClient,
} from "@uwe/database/server";
import {
  parseFormDataOrThrow,
  playerNoteCreateSchema,
  playerNoteIdSchema,
  playerNoteUpdateSchema,
} from "@uwe/security";
import {
  getAccessContextForWorld,
  getCurrentUser,
} from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

async function getAuthContext(worldSlug: string) {
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
  } finally {
    await db.$disconnect();
  }

  return { user, ctx };
}

export async function createPlayerNoteAction(formData: FormData) {
  await requirePortalActionAuth();
  const {
    worldSlug,
    campaignId,
    content,
    pageId,
    gameSessionId,
    returnPath,
  } = parseFormDataOrThrow(formData, playerNoteCreateSchema);
  const path = returnPath ?? `/auth/worlds/${worldSlug}`;

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
      pageId: pageId ?? null,
      gameSessionId: gameSessionId ?? null,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(path);
  revalidatePath(`/auth/worlds/${worldSlug}`);
}

export async function submitPlayerNoteAction(formData: FormData) {
  await requirePortalActionAuth();
  const { worldSlug, noteId, returnPath } = parseFormDataOrThrow(formData, playerNoteIdSchema);
  const path = returnPath ?? `/auth/worlds/${worldSlug}`;

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

  revalidatePath(path);
}

export async function updatePlayerNoteAction(formData: FormData) {
  await requirePortalActionAuth();
  const { worldSlug, noteId, content, returnPath } = parseFormDataOrThrow(
    formData,
    playerNoteUpdateSchema,
  );
  const path = returnPath ?? `/auth/worlds/${worldSlug}`;

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

  revalidatePath(path);
}
