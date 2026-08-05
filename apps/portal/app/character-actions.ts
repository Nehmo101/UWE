"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthService, prisma } from "@uwe/database/server";
import { createPlayerCharacterService } from "@uwe/player-hub";
import { parseFormDataOrThrow, playerCharacterBlockSchema } from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";

/**
 * Spieler legt seinen eigenen Charakter an — Wiki-Seite plus leerer Bogen.
 *
 * Die Kampagnen-Zuweisung bleibt bewusst draußen: sie gehört dem Spielleiter
 * und wohnt im Studio (Kampagnen-Cockpit). `redirect` steht außerhalb des
 * Service-Aufrufs, damit die Weiterleitungs-Ausnahme von Next.js nicht in
 * einem `catch` hängen bleibt.
 */
export async function createOwnCharacterAction(formData: FormData) {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "");

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const result = await createPlayerCharacterService(prisma).createOwnCharacter(worldSlug, ctx, {
    displayName,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath(`/auth/worlds/${worldSlug}/characters`);
  revalidatePath(`/auth/worlds/${worldSlug}`);
  redirect(`/auth/worlds/${worldSlug}/${result.pageSlug}`);
}

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

  const auth = createAuthService(prisma);

  const world = await prisma.world.findUnique({
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

  revalidatePath(path);
  revalidatePath(`/auth/worlds/${worldSlug}`);
}
