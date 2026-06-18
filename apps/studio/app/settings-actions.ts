"use server";

import {
  createAuthService,
  createPrismaClient,
  getAppRepository,
  mapServerBackgroundToClient,
  resolveThemePreferencesForScope,
  type BackgroundPattern,
  type UweSystemSettingsUpdate,
  type Visibility,
  type CanonicalStatus,
  type ThemeAppearance,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStudioTrusted } from "@/src/lib/authz";

function repo() {
  return getAppRepository();
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export async function updateSettingsAction(formData: FormData) {
  assertStudioTrusted();

  const tab = String(formData.get("tab") || "general");
  const update: UweSystemSettingsUpdate = {};

  switch (tab) {
    case "general": {
      const current = await repo().getSystemSettings();
      const backgroundPattern = String(
        formData.get("backgroundPattern") || "none",
      ) as BackgroundPattern;
      const frostedGlass = formData.has("frostedGlass");
      const studioPrefs = resolveThemePreferencesForScope(current.app, "studio");
      const portalPrefs = resolveThemePreferencesForScope(current.app, "portal");
      update.app = {
        theme: String(formData.get("theme") || "dark") as ThemeAppearance,
        backgroundPattern,
        frostedGlass,
        motionEnabled: formData.has("motionEnabled"),
        themePreferences: {
          studio: {
            ...studioPrefs,
            background: mapServerBackgroundToClient(backgroundPattern),
            frostedGlass,
          },
          portal: {
            ...portalPrefs,
            background: mapServerBackgroundToClient(backgroundPattern),
            frostedGlass,
          },
        },
      };
      break;
    }
    case "worlds":
      update.worlds = {
        defaultVisibility: String(formData.get("defaultVisibility") || "dm_only") as Visibility,
        defaultCanonicalStatus: String(
          formData.get("defaultCanonicalStatus") || "draft",
        ) as CanonicalStatus,
      };
      update.app = {
        favoriteWorldSlug: String(formData.get("favoriteWorldSlug") || "").trim() || null,
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
        exportsPath: String(formData.get("exportsPath") || ""),
      };
      break;
    case "ai":
      update.ai = {
        enabled: parseBoolean(formData.get("aiEnabled")),
        localOnlyMode: parseBoolean(formData.get("localOnlyMode")),
      };
      break;
    case "mail":
      update.mail = {
        enabled: parseBoolean(formData.get("mailEnabled")),
        fromDisplayName: String(formData.get("fromDisplayName") || ""),
        logBody: parseBoolean(formData.get("mailLogBody")),
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
  assertStudioTrusted();

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
