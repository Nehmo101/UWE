"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppRepository, prisma } from "@uwe/database/server";
import {
  createRollTableService,
  parseRollTableEntries,
  rollOnTable,
} from "@uwe/roll-tables";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function tablesPath(worldSlug: string) {
  return `/worlds/${worldSlug}/roll-tables`;
}

async function requireWorld(worldSlug: string) {
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }
  return world;
}

export async function createRollTableAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);
  const world = await requireWorld(worldSlug);

  const entries = parseRollTableEntries(String(formData.get("entries") || ""));
  await createRollTableService(prisma).create({
    worldId: world.id,
    name: String(formData.get("name") || ""),
    category: String(formData.get("category") || "custom"),
    dice: String(formData.get("dice") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    entries,
  });

  revalidatePath(tablesPath(worldSlug));
  redirect(`${tablesPath(worldSlug)}?saved=1`);
}

export async function updateRollTableAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);
  await requireWorld(worldSlug);

  const tableId = String(formData.get("tableId"));
  const entries = parseRollTableEntries(String(formData.get("entries") || ""));
  if (entries.length === 0) {
    throw new Error("Mindestens ein Tabellen-Eintrag ist erforderlich.");
  }

  await createRollTableService(prisma).update(tableId, {
    name: String(formData.get("name") || ""),
    category: String(formData.get("category") || "custom"),
    dice: String(formData.get("dice") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    entries,
  });

  revalidatePath(tablesPath(worldSlug));
  redirect(`${tablesPath(worldSlug)}?saved=1`);
}

export async function deleteRollTableAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  await createRollTableService(prisma).delete(String(formData.get("tableId")));

  revalidatePath(tablesPath(worldSlug));
  redirect(`${tablesPath(worldSlug)}?deleted=1`);
}

export async function seedRollTablePresetsAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);
  const world = await requireWorld(worldSlug);

  const result = await createRollTableService(prisma).seedPresets(world.id);

  revalidatePath(tablesPath(worldSlug));
  redirect(`${tablesPath(worldSlug)}?seeded=${result.created}`);
}

export async function rollOnTableAction(formData: FormData) {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const tableId = String(formData.get("tableId"));
  const table = await createRollTableService(prisma).get(tableId);
  if (!table) {
    throw new Error("Tabelle nicht gefunden.");
  }

  const result = rollOnTable(table.entries);
  const resultText = result ? result.entry.label : "Tabelle ist leer.";

  revalidatePath(tablesPath(worldSlug));
  redirect(
    `${tablesPath(worldSlug)}?rolledTable=${encodeURIComponent(tableId)}&rolled=${encodeURIComponent(
      resultText.slice(0, 300),
    )}`,
  );
}
