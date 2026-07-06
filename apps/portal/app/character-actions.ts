"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { createAuthService, createPrismaClient } from "@uwe/database/server";
import { parseFormDataOrThrow, playerCharacterBlockSchema } from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

export async function updatePlayerCharacterBlockAction(formData: FormData) {
  await requirePortalActionAuth();
  const { worldSlug, pageSlug, blockId, content, returnPath } = parseFormDataOrThrow(
    formData,
    playerCharacterBlockSchema,
  );
  const path = returnPath ?? `/auth/worlds/${worldSlug}/${pageSlug}`;

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new Error("Welt nicht gefunden");
    }
    assertPortalCanReadWorld(ctx, world.id);

    const updated = await auth.updatePlayerCharacterBlockForViewer(
      worldSlug,
      pageSlug,
      blockId,
      content,
      ctx,
    );
    if (!updated) {
      throw new Error("Keine Berechtigung");
    }
  } finally {
    await db.$disconnect();
  }

  revalidatePath(path);
  revalidatePath(`/auth/worlds/${worldSlug}`);
}
