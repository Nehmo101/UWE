"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
  buildPageUrl,
} from "@uwe/database/server";

function notes() {
  const db = createPrismaClient();
  return { db, auth: createAuthService(db) };
}

export async function acceptPlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));

  const { db, auth } = notes();
  try {
    await auth.getPlayerNoteService().accept(noteId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/notes`);
}

export async function hidePlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));

  const { db, auth } = notes();
  try {
    await auth.getPlayerNoteService().hide(noteId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/notes`);
}

export async function deletePlayerNoteAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));

  const { db, auth } = notes();
  try {
    await auth.getPlayerNoteService().softDelete(noteId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/notes`);
}

export async function adoptPlayerNoteAsContentBlockAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));
  const targetPageId = String(formData.get("targetPageId") || "");

  const { db, auth } = notes();
  let page: { slug: string; type: Parameters<typeof buildPageUrl>[1] } | null = null;

  try {
    const note = await auth.getPlayerNoteForDm(worldSlug, noteId);
    if (!note) {
      throw new Error("Notiz nicht gefunden");
    }

    const pageId = targetPageId || note.pageId;
    if (!pageId) {
      throw new Error("Keine Zielseite angegeben");
    }

    await auth.getPlayerNoteService().adoptAsContentBlock(noteId, pageId);
    page = await db.page.findUnique({
      where: { id: pageId },
      select: { slug: true, type: true },
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/notes`);
  if (page) {
    revalidatePath(buildPageUrl(worldSlug, page.type, page.slug));
  }
}

export async function adoptPlayerNoteAsPageAction(formData: FormData) {
  const worldSlug = String(formData.get("worldSlug"));
  const noteId = String(formData.get("noteId"));
  const title = String(formData.get("title") || "").trim();

  const { db, auth } = notes();
  let pageId: string | null = null;

  try {
    const result = await auth.getPlayerNoteService().adoptAsPage(noteId, {
      title: title || undefined,
    });
    pageId = result.pageId;
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/notes`);
  if (pageId) {
    const repo = getAppRepository();
    const page = await repo.getPageById(pageId);
    if (page) {
      redirect(buildPageUrl(worldSlug, page.type, page.slug) + "/edit");
    }
  }
}
