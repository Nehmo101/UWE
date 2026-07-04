"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@uwe/database/server";
import {
  createPageBulkService,
  type PageBulkOperation,
} from "@uwe/database/page-bulk";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

export interface BulkUpdatePagesResult {
  ok: boolean;
  message: string;
  changedCount: number;
  failedCount: number;
}

/**
 * Massenbearbeitung ausgewählter Seiten (Sichtbarkeit, Status, Typ, Tags,
 * Kampagne, Löschen). Jede Änderung ist über das Aktivitätsprotokoll rückgängig
 * machbar.
 */
export async function bulkUpdatePagesAction(
  worldSlug: string,
  pageIds: string[],
  operation: PageBulkOperation,
): Promise<BulkUpdatePagesResult> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const result = await createPageBulkService(prisma).apply(worldSlug, pageIds, operation);

  if (result.changedCount > 0) {
    revalidatePath(`/worlds/${worldSlug}`);
    revalidatePath(`/worlds/${worldSlug}/graph`);
  }

  return {
    ok: result.ok,
    message: result.message,
    changedCount: result.changedCount,
    failedCount: result.failedCount,
  };
}
