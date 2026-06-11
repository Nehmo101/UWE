"use server";

import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
  type UweSystemSettingsUpdate,
  type Visibility,
  type CanonicalStatus,
  type ThemeAppearance,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function repo() {
  return getAppRepository();
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export async function updateSettingsAction(formData: FormData) {
  const tab = String(formData.get("tab") || "general");
  const update: UweSystemSettingsUpdate = {};

  switch (tab) {
    case "general":
      update.app = {
        theme: String(formData.get("theme") || "dark") as ThemeAppearance,
      };
      break;
    case "worlds":
      update.worlds = {
        defaultVisibility: String(formData.get("defaultVisibility") || "dm_only") as Visibility,
        defaultCanonicalStatus: String(
          formData.get("defaultCanonicalStatus") || "draft",
        ) as CanonicalStatus,
      };
      break;
    case "portal":
      update.portal = {
        portalEnabled: parseBoolean(formData.get("portalEnabled")),
        guestAccessEnabled: parseBoolean(formData.get("guestAccessEnabled")),
        publicSharingEnabled: parseBoolean(formData.get("publicSharingEnabled")),
      };
      break;
    case "privacy":
      update.privacy = {
        restrictPublicExport: parseBoolean(formData.get("restrictPublicExport")),
      };
      break;
    case "storage":
      update.storage = {
        uploadsPath: String(formData.get("uploadsPath") || ""),
      };
      break;
    case "ai":
      update.ai = {
        enabled: parseBoolean(formData.get("aiEnabled")),
        localOnlyMode: parseBoolean(formData.get("localOnlyMode")),
      };
      break;
    case "backup":
      update.backup = {
        backupsPath: String(formData.get("backupsPath") || ""),
        autoBackupEnabled: parseBoolean(formData.get("autoBackupEnabled")),
      };
      break;
    default:
      throw new Error(`Unknown settings tab: ${tab}`);
  }

  await repo().updateSystemSettings(update);

  revalidatePath("/settings");
  redirect(`/settings?tab=${tab}&saved=1`);
}

export async function setWorldGuestModeAction(formData: FormData) {
  const worldId = String(formData.get("worldId"));
  const enabled = parseBoolean(formData.get("guestModeEnabled"));
  const tab = String(formData.get("tab") || "worlds");

  const db = createPrismaClient();
  const auth = createAuthService(db);

  await auth.setWorldGuestMode(worldId, enabled);
  await db.$disconnect();

  revalidatePath("/settings");
  redirect(`/settings?tab=${tab}&saved=1`);
}
