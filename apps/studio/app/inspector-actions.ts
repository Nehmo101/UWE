"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createActivityLogService,
  createInspectorFixService,
  createUndoService,
  prisma,
  type InspectorFixAction,
} from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { revalidatePath } from "next/cache";
import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
import { redirect } from "next/navigation";
import {
  requireStudioContentEdit,
  requireStudioWorldEdit,
} from "@/src/lib/authz";

const FIX_ACTIONS: InspectorFixAction[] = ["remove_broken_wiki_link", "assign_page_campaign"];

export async function applyInspectorFixAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  const action = String(formData.get("fixAction")) as InspectorFixAction;
  const pageId = String(formData.get("pageId") || "");

  if (pageId) {
    await requireStudioContentEdit(worldSlug, pageId);
  } else {
    await requireStudioWorldEdit(worldSlug);
  }

  if (!FIX_ACTIONS.includes(action)) {
    redirect(`/worlds/${worldSlug}/inspector?fixError=unbekannte+Aktion`);
  }

  const result = await createInspectorFixService(prisma).applyFix({
    worldSlug,
    action,
    pageId: String(formData.get("pageId") || "") || undefined,
    linkTarget: String(formData.get("linkTarget") || "") || undefined,
  });

  revalidatePath(`/worlds/${worldSlug}/inspector`);
  revalidateWorldRootAndWiki(worldSlug);
  revalidatePath("/");

  const param = result.ok
    ? `fixApplied=${encodeURIComponent(result.message)}`
    : `fixError=${encodeURIComponent(result.message)}`;
  redirect(`/worlds/${worldSlug}/inspector?${param}`);
}

/** Undo a change from the activity log (inspector fixes, deletions). */
export async function undoActivityAction(formData: FormData) {
  await requireStudioActionAuth();

  const undoEntryId = String(formData.get("undoEntryId"));
  const redirectTo = String(formData.get("redirectTo") || "/");

  const undoService = createUndoService(brainPrisma, prisma);
  const result = await undoService.undo(undoEntryId);

  if (result.ok) {
    const entry = await prisma.undoEntry.findUnique({ where: { id: undoEntryId } });
    await createActivityLogService(prisma).log({
      worldId: entry?.worldId,
      action: "content_restored",
      targetType: entry?.targetType ?? "system",
      targetId: entry?.targetId,
      summary: `Rückgängig gemacht: ${result.message}`,
      details: { undoEntryId },
    });
  }

  revalidatePath("/");
  revalidatePath(redirectTo);

  const param = result.ok
    ? `undoApplied=${encodeURIComponent(result.message)}`
    : `undoError=${encodeURIComponent(result.message)}`;
  const separator = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${separator}${param}`);
}
