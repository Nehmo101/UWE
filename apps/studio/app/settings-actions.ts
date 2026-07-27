"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  getAppRepository,
  mapServerBackgroundToClient,
  resolveThemePreferencesForScope,
  validateSettingsUpdate,
  type BackgroundPattern,
  type UweSystemSettingsUpdate,
  type ThemeAppearance,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Studio-Einstellungen speichern — Design und Startseite, mehr nicht.
 *
 * Alles andere (Portal, Welten, KI, Mail, Image Studio, Speicher, Backup,
 * Briefing, Privatsphäre, Anmeldung, Notfallmodus) wird in der Kommandozentrale
 * gesetzt (Abschnitt D33). Deren `settings-update` schreibt auch die
 * host-lesbaren Schedule-Dateien mit — hier gibt es nichts zu syncen, weil
 * keiner der beiden verbliebenen Tabs einen Timer betrifft.
 */

function repo() {
  return getAppRepository();
}

export async function updateSettingsAction(formData: FormData) {
  await requireStudioActionAuth();

  const tab = String(formData.get("tab") || "general");
  const update: UweSystemSettingsUpdate = {};

  switch (tab) {
    case "landing":
      update.app = {
        defaultLandingPage: String(formData.get("defaultLandingPage") || "/worlds").trim() || "/worlds",
      };
      break;
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
    default:
      throw new Error(`Unknown settings tab: ${tab}`);
  }

  // Validate through the same guard the settings API uses, so a raw enum cast
  // (theme, backgroundPattern) cannot slip into the settings JSON. The action
  // additionally builds `themePreferences`, which the validator does not model;
  // strip it from the validation input but persist the update unchanged.
  const validationInput = structuredClone(update);
  if (validationInput.app) {
    delete (validationInput.app as { themePreferences?: unknown }).themePreferences;
  }
  const validation = validateSettingsUpdate(validationInput);
  if (!validation.ok) {
    throw new Error(`Ungültige Einstellungen: ${validation.errors.join(" ")}`);
  }

  await repo().updateSystemSettings(update);

  if (update.app?.defaultLandingPage !== undefined) {
    revalidatePath("/");
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
