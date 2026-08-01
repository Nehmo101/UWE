"use server";

import { revalidatePath } from "next/cache";
import { prisma, createUweRepositoryFromClient, createUndoService } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  previewTransferPages,
  transferPagesToWorld,
  type TransferPreview,
} from "@uwe/doc-import/transfer";
import { revalidateWorldRootAndWiki } from "@/src/lib/world-revalidate";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Seiten aus einer Welt in eine andere übernehmen.
 *
 * Gedacht für fremdes Material: ein gekaufter Band landet erst in einer
 * Werkstatt-Welt ohne Spieler-Zuordnung, und nur die kuratierten Teile wandern
 * weiter. Beide Welten werden auf Schreibrecht geprüft — lesen aus der Quelle
 * genügt nicht, wenn daraus in der Zielwelt Inhalte entstehen.
 */

export interface TransferTargetWorld {
  slug: string;
  name: string;
}

export async function listTransferTargetWorldsAction(
  sourceWorldSlug: string,
): Promise<TransferTargetWorld[]> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(sourceWorldSlug);

  const worlds = await prisma.world.findMany({
    where: { slug: { not: sourceWorldSlug } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return worlds;
}

export async function previewTransferPagesAction(input: {
  sourceWorldSlug: string;
  targetWorldSlug: string;
  pageIds: string[];
  includeDescendants?: boolean;
}): Promise<TransferPreview> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.sourceWorldSlug);
  await requireStudioWorldEdit(input.targetWorldSlug);

  return previewTransferPages(createUweRepositoryFromClient(prisma), input);
}

export interface TransferPagesActionResult {
  created: number;
  failed: number;
  danglingLinks: string[];
  warnings: string[];
  undoToken: string | null;
}

export async function transferPagesAction(input: {
  sourceWorldSlug: string;
  targetWorldSlug: string;
  pageIds: string[];
  includeDescendants?: boolean;
  targetCampaignId?: string | null;
}): Promise<TransferPagesActionResult> {
  await requireStudioActionAuth();
  await requireStudioWorldEdit(input.sourceWorldSlug);
  await requireStudioWorldEdit(input.targetWorldSlug);

  const repo = createUweRepositoryFromClient(prisma);
  const result = await transferPagesToWorld(repo, { ...input, confirmed: true });

  let undoToken: string | null = null;
  if (result.undo.createdPageIds.length > 0) {
    const targetWorld = await repo.getWorldBySlug(input.targetWorldSlug);
    if (targetWorld) {
      const entry = await createUndoService(brainPrisma, prisma).captureImportExecute({
        worldId: targetWorld.id,
        createdPageIds: result.undo.createdPageIds,
        updatedPages: [],
      });
      undoToken = entry?.id ?? null;
    }

    revalidateWorldRootAndWiki(input.targetWorldSlug);
    revalidatePath(`/worlds/${input.targetWorldSlug}/graph`);
  }

  return {
    created: result.created,
    failed: result.failed,
    danglingLinks: result.danglingLinks,
    warnings: result.warnings,
    undoToken,
  };
}
