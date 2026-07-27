"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPrismaClient,
  createWorldEventService,
  getAppRepository,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioContentEdit, requireStudioWorldEdit } from "@/src/lib/authz";

function editPath(worldSlug: string, category: string, pageSlug: string) {
  return `/worlds/${worldSlug}/${category}/${pageSlug}/edit`;
}

function parseInGameDateFromForm(formData: FormData) {
  const year = Number(formData.get("inGameYear"));
  const month = Number(formData.get("inGameMonth"));
  const day = Number(formData.get("inGameDay"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error("In-Game-Datum ist ungültig.");
  }
  return {
    year: Math.floor(year),
    month: Math.floor(month),
    day: Math.floor(day),
  };
}

export async function createWorldEventAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const title = String(formData.get("title") || "").trim();
  const summaryPlayer = String(formData.get("summaryPlayer") || "").trim() || null;
  const summaryDm = String(formData.get("summaryDm") || "").trim() || null;
  const pageId = String(formData.get("pageId") || "") || null;
  const pageSlug = String(formData.get("pageSlug") || "");
  const category = String(formData.get("category") || "");
  const returnTo = String(formData.get("returnTo") || "page");

  if (!title) {
    throw new Error("Titel ist erforderlich.");
  }

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    if (pageId) {
      await requireStudioContentEdit(worldSlug, pageId);
    } else {
      await requireStudioWorldEdit(worldSlug);
    }

    const events = createWorldEventService(db);
    await events.create({
      worldId: world.id,
      title,
      inGameDate: parseInGameDateFromForm(formData),
      summaryPlayer,
      summaryDm,
      linkedPages: pageId ? [{ pageId, role: "involved" }] : undefined,
    });
  } finally {
    await db.$disconnect();
  }

  if (returnTo === "chronicle") {
    revalidatePath(`/worlds/${worldSlug}/chronicle`);
    redirect(`/worlds/${worldSlug}/chronicle?saved=1`);
  }

  if (pageId && pageSlug && category) {
    revalidatePath(editPath(worldSlug, category, pageSlug));
    redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
  }

  revalidatePath(`/worlds/${worldSlug}/chronicle`);
  redirect(`/worlds/${worldSlug}/chronicle?saved=1`);
}

export async function deleteWorldEventAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const eventId = String(formData.get("eventId"));
  const pageId = String(formData.get("pageId") || "") || null;
  const pageSlug = String(formData.get("pageSlug") || "");
  const category = String(formData.get("category") || "");
  const returnTo = String(formData.get("returnTo") || "page");

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    if (pageId) {
      await requireStudioContentEdit(worldSlug, pageId);
    } else {
      await requireStudioWorldEdit(worldSlug);
    }

    const events = createWorldEventService(db);
    await events.deleteById(world.id, eventId);
  } finally {
    await db.$disconnect();
  }

  if (returnTo === "chronicle") {
    revalidatePath(`/worlds/${worldSlug}/chronicle`);
    redirect(`/worlds/${worldSlug}/chronicle?deleted=1`);
  }

  if (pageId && pageSlug && category) {
    revalidatePath(editPath(worldSlug, category, pageSlug));
    redirect(`${editPath(worldSlug, category, pageSlug)}?saved=1`);
  }

  revalidatePath(`/worlds/${worldSlug}/chronicle`);
  redirect(`/worlds/${worldSlug}/chronicle?deleted=1`);
}
