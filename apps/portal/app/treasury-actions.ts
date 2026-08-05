"use server";

import { requirePortalActionAuth } from "@/src/lib/portal-action-auth";
import { revalidatePath } from "next/cache";
import { createPartyTreasuryService, prisma } from "@uwe/database/server";
import {
  createGroupTreasuryService,
  TREASURY_CURRENCIES,
} from "@uwe/player-hub";
import {
  parseFormDataOrThrow,
  treasuryItemAssignSchema,
  treasuryItemReturnSchema,
} from "@uwe/security";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";

function revalidateTreasuryPaths(worldSlug: string, returnPath?: string) {
  revalidatePath(`/auth/worlds/${worldSlug}/treasury`);
  revalidatePath(`/auth/worlds/${worldSlug}/characters`);
  if (returnPath) {
    revalidatePath(returnPath);
  }
}

/** Spieler übernimmt ein Treasury-Item in das Inventar eines EIGENEN Charakters. */
export async function assignTreasuryItemToCharacterAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, treasuryItemAssignSchema);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const treasury = createPartyTreasuryService(prisma);
  const moved = await treasury.moveItemForViewer(parsed.worldSlug, ctx, {
    itemId: parsed.itemId,
    targetCharacterId: parsed.characterId,
  });
  if (!moved) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(parsed.worldSlug, parsed.returnPath);
}

/*
 * Gruppenschatz aus Spielerhand — die Schreibwege der Tischrunde.
 *
 * Alle vier Actions laufen durch `GroupTreasuryService.requireWritableTreasury`:
 * geschrieben wird ausschließlich in den Schatz der EIGENEN Gruppe, nie in den
 * welt-weiten und nie in den einer fremden Runde. Vorschau-Sitzungen und
 * Konten ohne Welt-Zuordnung prallen dort ab, nicht hier — die Prüfung sitzt
 * bei den Daten.
 */

async function requireViewerContext(worldSlug: string) {
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }
  return ctx;
}

/** Münzbilanz der eigenen Gruppe setzen (Platin bis Kupfer, absolute Werte). */
export async function updateGroupTreasuryAction(formData: FormData) {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const ctx = await requireViewerContext(worldSlug);

  const currencies: Partial<Record<(typeof TREASURY_CURRENCIES)[number], number>> = {};
  for (const key of TREASURY_CURRENCIES) {
    const raw = Number(formData.get(`currency_${key}`) ?? 0);
    currencies[key] = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  }

  const service = createGroupTreasuryService(prisma);
  const okCurrencies = await service.updateCurrenciesForViewer(worldSlug, ctx, currencies);
  const okNotes = await service.updateNotesForViewer(
    worldSlug,
    ctx,
    String(formData.get("notes") ?? ""),
  );
  if (!okCurrencies || !okNotes) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(worldSlug);
}

/** Gegenstand von Hand in den Gruppenschatz eintragen. */
export async function addGroupTreasuryItemAction(formData: FormData) {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const ctx = await requireViewerContext(worldSlug);

  const ok = await createGroupTreasuryService(prisma).addItemForViewer(worldSlug, ctx, {
    name: String(formData.get("name") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!ok) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(worldSlug);
}

/** Menge, Name oder Notiz eines Gegenstands im eigenen Gruppenschatz ändern. */
export async function updateGroupTreasuryItemAction(formData: FormData) {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const ctx = await requireViewerContext(worldSlug);

  const ok = await createGroupTreasuryService(prisma).updateItemForViewer(worldSlug, ctx, {
    itemId: String(formData.get("itemId") ?? ""),
    name: String(formData.get("name") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!ok) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(worldSlug);
}

/** Gegenstand aus dem eigenen Gruppenschatz streichen. */
export async function removeGroupTreasuryItemAction(formData: FormData) {
  await requirePortalActionAuth();
  const worldSlug = String(formData.get("worldSlug") ?? "").trim();
  const ctx = await requireViewerContext(worldSlug);

  const ok = await createGroupTreasuryService(prisma).removeItemForViewer(
    worldSlug,
    ctx,
    String(formData.get("itemId") ?? ""),
  );
  if (!ok) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(worldSlug);
}

/** Spieler legt ein Item aus dem EIGENEN Charakter-Inventar zurück in die Schatzkammer. */
export async function returnTreasuryItemFromCharacterAction(formData: FormData) {
  await requirePortalActionAuth();
  const parsed = parseFormDataOrThrow(formData, treasuryItemReturnSchema);

  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(parsed.worldSlug);
  if (!user || !ctx) {
    throw new Error("Nicht angemeldet");
  }

  const treasury = createPartyTreasuryService(prisma);
  const moved = await treasury.moveItemForViewer(parsed.worldSlug, ctx, {
    itemId: parsed.itemId,
    targetCharacterId: null,
  });
  if (!moved) {
    throw new Error("Keine Berechtigung");
  }

  revalidateTreasuryPaths(parsed.worldSlug, parsed.returnPath);
}
