"use server";

import {
  buildAppSettingsFromThemePreferences,
  getAppRepository,
  getSystemSettingsSnapshot,
  normalizeThemePreferencesRecord,
  type ThemePreferencesRecord,
  type ThemePreferencesScope,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { assertStudioTrusted } from "@/src/lib/authz";

export async function saveThemePreferencesAction(
  scope: ThemePreferencesScope,
  preferences: ThemePreferencesRecord,
): Promise<string> {
  assertStudioTrusted();

  const normalized = normalizeThemePreferencesRecord(preferences, scope);
  if (!normalized) {
    throw new Error("Ungültige Theme-Einstellungen");
  }

  const repo = getAppRepository();
  const current = await repo.getSystemSettings();
  await repo.updateSystemSettings({
    app: buildAppSettingsFromThemePreferences(current.app, scope, normalized),
  });

  revalidatePath("/settings");
  const { updatedAt } = await getSystemSettingsSnapshot();
  return updatedAt ?? new Date().toISOString();
}
