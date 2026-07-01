"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPartyTreasuryService,
  createPrismaClient,
  DEFAULT_CURRENCIES,
  getAppRepository,
  type CurrencyLedger,
} from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

const CURRENCY_KEYS = Object.keys(DEFAULT_CURRENCIES) as (keyof typeof DEFAULT_CURRENCIES)[];

function parseCurrenciesFromForm(formData: FormData): CurrencyLedger {
  const currencies = { ...DEFAULT_CURRENCIES };
  for (const key of CURRENCY_KEYS) {
    const raw = Number(formData.get(`currency_${key}`) ?? 0);
    currencies[key] = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  }
  return currencies;
}

function parseOptionalNumber(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function updatePartyTreasuryAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const name = String(formData.get("name") || "").trim() || "Gruppenschatz";
  const notes = String(formData.get("notes") || "").trim();

  await requireStudioWorldEdit(worldSlug);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const treasury = createPartyTreasuryService(db);
    await treasury.upsert({
      worldId: world.id,
      name,
      notes,
      currencies: parseCurrenciesFromForm(formData),
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/treasury`);
  redirect(`/worlds/${worldSlug}/treasury?saved=1`);
}

export async function addPartyInventoryItemAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;
  const weight = parseOptionalNumber(formData, "weight");
  const valueGp = parseOptionalNumber(formData, "valueGp");

  if (!name) {
    throw new Error("Name ist erforderlich.");
  }

  await requireStudioWorldEdit(worldSlug);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const treasury = createPartyTreasuryService(db);
    const record = await treasury.getOrCreateForWorld(world.id);
    await treasury.addItem({
      worldId: world.id,
      treasuryId: record.id,
      name,
      quantity,
      weight,
      value: valueGp != null ? { gp: valueGp } : undefined,
      notes,
    });
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/treasury`);
  redirect(`/worlds/${worldSlug}/treasury?added=1`);
}

export async function deletePartyInventoryItemAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const itemId = String(formData.get("itemId") || "").trim();

  if (!itemId) {
    throw new Error("Item-ID fehlt.");
  }

  await requireStudioWorldEdit(worldSlug);

  const db = createPrismaClient();
  try {
    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      throw new Error("Welt nicht gefunden.");
    }

    const treasury = createPartyTreasuryService(db);
    await treasury.deleteItem(world.id, itemId);
  } finally {
    await db.$disconnect();
  }

  revalidatePath(`/worlds/${worldSlug}/treasury`);
  redirect(`/worlds/${worldSlug}/treasury?deleted=1`);
}
