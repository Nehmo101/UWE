"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { getAppRepository, getSystemSettingsSnapshot } from "@uwe/database/server";
import {
  normalizeCustomThemeRecord,
  removeCustomTheme,
  upsertCustomTheme,
  type CustomThemeRecord,
} from "@uwe/database/custom-theme-preferences";
import { revalidatePath } from "next/cache";

/** Create or update an installation-wide custom theme palette. */
export async function saveCustomThemeAction(input: CustomThemeRecord): Promise<string> {
  await requireStudioActionAuth();

  const withTimestamp = {
    ...input,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  const normalized = normalizeCustomThemeRecord(withTimestamp);
  if (!normalized) {
    throw new Error("Ungültiges Custom-Design");
  }

  const repo = getAppRepository();
  const current = await repo.getSystemSettings();
  await repo.updateSystemSettings({
    app: { customThemes: upsertCustomTheme(current.app.customThemes, normalized) },
  });

  revalidatePath("/settings");
  const { updatedAt } = await getSystemSettingsSnapshot();
  return updatedAt ?? new Date().toISOString();
}

/** Remove a custom theme by id. */
export async function deleteCustomThemeAction(id: string): Promise<string> {
  await requireStudioActionAuth();

  const repo = getAppRepository();
  const current = await repo.getSystemSettings();
  await repo.updateSystemSettings({
    app: { customThemes: removeCustomTheme(current.app.customThemes, id) },
  });

  revalidatePath("/settings");
  const { updatedAt } = await getSystemSettingsSnapshot();
  return updatedAt ?? new Date().toISOString();
}
