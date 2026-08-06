"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthService, prisma } from "@uwe/database/server";
import { createPlayerCharacterService } from "@uwe/player-hub";
import {
  characterDraftPayloadSchema,
  parseFormDataOrThrow,
  playerCharacterBlockSchema,
} from "@uwe/security";
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

/**
 * Grobe Obergrenze für den Entwurf, bevor überhaupt geparst wird.
 *
 * Der größte legitime Entwurf liegt bei wenigen Kilobyte — dreizehn
 * Freitextfelder à 5.000 Zeichen sind der Deckel. Alles darüber ist kein
 * Charakter, sondern ein Versuch, den JSON-Parser zu beschäftigen.
 */
const DRAFT_PAYLOAD_MAX = 100_000;

/**
 * Der fertige Charakter aus dem Ersteller.
 *
 * Anders als `createOwnCharacterAction` kommt hier kein FormData an, sondern
 * eine JSON-Zeichenkette: der Entwurf ist verschachtelt, und Server Actions
 * nehmen nur serialisierbare Argumente. Die Zielwelt steckt im Umschlag mit
 * drin, damit die Aktion ohne Bindung an die Route auskommt.
 *
 * Drei Tore, in dieser Reihenfolge: `requirePortalActionAuth` (CSRF und
 * Sitzung, wie bei jeder Portal-Aktion), das zod-Schema (Form und Grenzen)
 * und zuletzt der Dienst, der Zugangsregel *und* Spielregeln noch einmal
 * komplett gegen den Katalog prüft. Was der Browser geprüft hat, zählt an
 * dieser Stelle nichts.
 */
export async function createFullCharacterAction(payload: string): Promise<void> {
  await requirePortalActionAuth();

  if (typeof payload !== "string" || payload.length > DRAFT_PAYLOAD_MAX) {
    throw new Error("Der Entwurf ist zu groß.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new Error("Der Entwurf konnte nicht gelesen werden.");
  }

  const parsed = characterDraftPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Der Entwurf ist unvollständig oder fehlerhaft.");
  }
  const { worldSlug, draft } = parsed.data;

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const result = await createPlayerCharacterService(prisma).createFullCharacter(
    worldSlug,
    ctx,
    draft,
  );
  if (!result.ok) {
    // Die Regelhinweise gehören in die Meldung: „unvollständig" allein
    // schickt den Spieler auf die Suche durch neun Schritte.
    throw new Error(
      result.issues.length > 0 ? `${result.error} ${result.issues.join(" ")}` : result.error,
    );
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
