"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createPrintListService,
  getAppRepository,
  type LabelPrintStatus,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireStudioContentEdit,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

// Drucklisten-Server-Actions — aus `label-actions.ts` herausgezogen (Modul-Disziplin).
// Server-Actions dürfen nicht per Re-Export identitätsverlagert werden; deshalb sind
// die Aktionen physisch hierher verschoben und die privaten Helfer dupliziert.
// Verhalten/Signaturen unverändert.

function printLists() {
  return createPrintListService();
}

function repo() {
  return getAppRepository();
}

type ActivityTargetType = "label" | "print_list";

async function logLabelActivity(
  worldSlug: string,
  worldId: string,
  action: "content_created" | "content_updated" | "export_executed",
  targetType: ActivityTargetType,
  targetId: string,
  title: string,
  summary: string,
  targetHref: string,
) {
  try {
    const { prisma: db } = await import("@uwe/database/server");
    await db.activityLog.create({
      data: {
        worldId,
        worldSlug,
        action,
        targetType,
        targetId,
        targetLabel: title,
        targetHref,
        summary,
      },
    });
  } catch {
    // Activity log must not break actions
  }
}

export async function createPrintListAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const list = await printLists().create({
    worldId: world.id,
    name: String(formData.get("name") || "Neue Druckliste"),
    description: String(formData.get("description") || "") || null,
    forNextSession: formData.get("forNextSession") === "on",
  });

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "print_list",
    list.id,
    list.name,
    "Druckliste erstellt",
    `/worlds/${worldSlug}/labels/print-lists/${list.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${list.id}?created=1`);
}

export async function preparePrintListFromSessionAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const sessionId = String(formData.get("sessionId"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const session = await repo().getGameSessionById(sessionId);
  if (!session || session.worldId !== world.id) throw new Error("Session not found");

  const pageIds = session.linkedPages.map((page) => page.id);
  if (pageIds.length === 0) throw new Error("Keine verknüpften Seiten");

  const list = await printLists().createFromPageIds(
    world.id,
    String(formData.get("name") || `Session: ${session.title}`),
    pageIds,
    { forNextSession: formData.get("forNextSession") === "on" },
  );

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "print_list",
    list.id,
    list.name,
    "Druckliste aus Session vorbereitet",
    `/worlds/${worldSlug}/labels/print-lists/${list.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/sessions/${sessionId}`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${list.id}?created=1`);
}

export async function preparePrintListFromRoomAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const roomPageId = String(formData.get("roomPageId"));
  const childPageIds = String(formData.get("childPageIds") || "")
    .split(",")
    .filter(Boolean);

  await requireStudioContentEdit(worldSlug, roomPageId);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const list = await printLists().createFromRoomAndChildren(
    world.id,
    String(formData.get("name") || "Raum-Druckliste"),
    roomPageId,
    childPageIds,
    { forNextSession: formData.get("forNextSession") === "on" },
  );

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "print_list",
    list.id,
    list.name,
    "Druckliste aus Dungeon-Raum vorbereitet",
    `/worlds/${worldSlug}/labels/print-lists/${list.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${list.id}?created=1`);
}

export async function preparePrintListFromPageAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const pageId = String(formData.get("pageId"));
  await requireStudioContentEdit(worldSlug, pageId);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const list = await printLists().createFromPageIds(
    world.id,
    String(formData.get("name") || "Seiten-Druckliste"),
    [pageId],
    { forNextSession: formData.get("forNextSession") === "on" },
  );

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_created",
    "print_list",
    list.id,
    list.name,
    "Druckliste aus Seite vorbereitet",
    `/worlds/${worldSlug}/labels/print-lists/${list.id}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${list.id}?created=1`);
}

export async function addLabelToPrintListAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const printListId = String(formData.get("printListId"));
  const labelId = String(formData.get("labelId"));
  const copies = Number(formData.get("copies") || 1);

  await requireStudioWorldEdit(worldSlug);

  await printLists().addLabel(printListId, labelId, copies);

  revalidatePath(`/worlds/${worldSlug}/labels`);
  revalidatePath(`/worlds/${worldSlug}/labels/print-lists/${printListId}`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${printListId}?added=1`);
}

export async function updatePrintListAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const printListId = String(formData.get("printListId"));
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) throw new Error("World not found");

  const labelOrder = String(formData.get("labelOrder") || "");
  if (labelOrder) {
    await printLists().reorderItems(printListId, labelOrder.split(",").filter(Boolean));
  }

  const copiesJson = String(formData.get("copiesJson") || "");
  if (copiesJson) {
    const copies = JSON.parse(copiesJson) as Record<string, number>;
    for (const [labelId, count] of Object.entries(copies)) {
      await printLists().setItemCopies(printListId, labelId, count);
    }
  }

  await printLists().update(printListId, {
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    description: formData.has("description")
      ? String(formData.get("description") || "") || null
      : undefined,
    forNextSession: formData.has("forNextSession")
      ? formData.get("forNextSession") === "on"
      : undefined,
  });

  await logLabelActivity(
    worldSlug,
    world.id,
    "content_updated",
    "print_list",
    printListId,
    String(formData.get("name") || "Druckliste"),
    "Druckliste geändert",
    `/worlds/${worldSlug}/labels/print-lists/${printListId}`,
  );

  revalidatePath(`/worlds/${worldSlug}/labels/print-lists/${printListId}`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${printListId}?saved=1`);
}

export async function setPrintListStatusAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const printListId = String(formData.get("printListId"));
  const status = String(formData.get("status")) as LabelPrintStatus;

  await requireStudioWorldEdit(worldSlug);

  await printLists().markStatus(printListId, status);

  const world = await repo().getWorldBySlug(worldSlug);
  const list = await printLists().getById(printListId);
  if (world && list) {
    await logLabelActivity(
      worldSlug,
      world.id,
      status === "printed" ? "export_executed" : "content_updated",
      "print_list",
      printListId,
      list.name,
      status === "printed" ? "Druckliste gedruckt" : `Druckliste-Status: ${status}`,
      `/worlds/${worldSlug}/labels/print-lists/${printListId}`,
    );
  }

  revalidatePath(`/worlds/${worldSlug}/labels`);
  revalidatePath(`/worlds/${worldSlug}/labels/print-lists/${printListId}`);
  redirect(`/worlds/${worldSlug}/labels/print-lists/${printListId}?status=${status}`);
}

export async function deletePrintListAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const printListId = String(formData.get("printListId"));

  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  const list = await printLists().getById(printListId);

  await printLists().delete(printListId);

  if (world && list) {
    await logLabelActivity(
      worldSlug,
      world.id,
      "content_updated",
      "print_list",
      printListId,
      list.name,
      "Druckliste gelöscht",
      `/worlds/${worldSlug}/labels?tab=print-lists`,
    );
  }

  revalidatePath(`/worlds/${worldSlug}/labels`);
  redirect(`/worlds/${worldSlug}/labels?tab=print-lists&deleted=1`);
}

export async function logPrintListExportActivity(
  worldSlug: string,
  printListId: string,
  name: string,
  format: string,
) {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const world = await repo().getWorldBySlug(worldSlug);
  if (!world) return;

  await logLabelActivity(
    worldSlug,
    world.id,
    "export_executed",
    "print_list",
    printListId,
    name,
    `Druckliste exportiert (${format})`,
    `/worlds/${worldSlug}/labels/print-lists/${printListId}`,
  );
}
