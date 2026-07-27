"use server";

import { revalidatePath } from "next/cache";
import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
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
    revalidateWorldRootAndWiki(worldSlug);
    revalidatePath(`/worlds/${worldSlug}/graph`);
  }

  return {
    ok: result.ok,
    message: result.message,
    changedCount: result.changedCount,
    failedCount: result.failedCount,
  };
}

export type WorldReleaseMode = "release" | "hide";

/**
 * Globales Freigeben: setzt ALLE Wissenstexte einer Welt in einem Rutsch auf
 * „Portal sichtbar“ + „veröffentlicht“ (mode="release") bzw. zurück auf
 * „Nur GM“ (mode="hide"). Als-dm_only markierte Blöcke/Geheimnisse bleiben
 * unberührt und damit weiterhin verborgen. Jede Änderung ist über das
 * Aktivitätsprotokoll rückgängig machbar.
 */
export async function releaseAllWorldPagesAction(
  worldSlug: string,
  mode: WorldReleaseMode,
): Promise<BulkUpdatePagesResult> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(worldSlug);

  const world = await prisma.world.findUnique({
    where: { slug: worldSlug },
    select: { id: true },
  });
  if (!world) {
    return { ok: false, message: "Welt nicht gefunden.", changedCount: 0, failedCount: 0 };
  }

  const pages = await prisma.page.findMany({
    where: { worldId: world.id },
    select: { id: true },
  });
  const pageIds = pages.map((page) => page.id);
  if (pageIds.length === 0) {
    return { ok: false, message: "Keine Wissenstexte vorhanden.", changedCount: 0, failedCount: 0 };
  }

  const operations: PageBulkOperation[] =
    mode === "release"
      ? [
          { kind: "visibility", visibility: "player_visible" },
        ]
      : [{ kind: "visibility", visibility: "dm_only" }];

  const service = createPageBulkService(prisma);
  let changedCount = 0;
  let failedCount = 0;
  for (const operation of operations) {
    const result = await service.apply(worldSlug, pageIds, operation);
    changedCount += result.changedCount;
    failedCount += result.failedCount;
  }

  revalidateWorldRootAndWiki(worldSlug);
  revalidatePath(`/worlds/${worldSlug}/graph`);

  const message =
    mode === "release"
      ? `${pageIds.length} Wissenstext(e) freigegeben (Portal sichtbar + veröffentlicht).`
      : `${pageIds.length} Wissenstext(e) auf „Nur GM“ gesetzt.`;

  return {
    ok: failedCount === 0,
    message: failedCount > 0 ? `${message} ${failedCount} übersprungen.` : message,
    changedCount,
    failedCount,
  };
}
