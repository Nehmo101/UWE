"use server";

import { revalidatePath } from "next/cache";
import { getAppRepository, validateSettingsUpdate } from "@uwe/database/server";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

function sanitizeHiddenNavIds(hiddenIds: string[]): string[] {
  return [...new Set(
    hiddenIds
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.length <= 80),
  )].slice(0, 150);
}

/** Persist sidebar visibility prefs from System → Navigation (#611). */
export async function updateHiddenNavIdsAction(hiddenIds: string[]): Promise<{ ok: true }> {
  await requireStudioActionAuth();

  const sanitized = sanitizeHiddenNavIds(hiddenIds);
  const validation = validateSettingsUpdate({ app: { hiddenNavIds: sanitized } });
  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  await getAppRepository().updateSystemSettings(validation.value);
  revalidatePath("/", "layout");
  revalidatePath("/system/navigation");

  return { ok: true };
}
