"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireOwner } from "@/src/lib/auth";
import { buildGoogleOAuthSettingsUpdate } from "@uwe/database/login-methods-settings";
import {
  createAuthService,
  prisma,
  getAppRepository,
  mapServerBackgroundToClient,
  resolveThemePreferencesForScope,
  buildMailSmtpCredentialsUpdate,
  buildAiProviderKeyUpdate,
  validateSettingsUpdate,
  type BackgroundPattern,
  type UweSystemSettingsUpdate,
  type Visibility,
  type CanonicalStatus,
  type ThemeAppearance,
  type AiProviderStoredKey,
} from "@uwe/database/server";
import { normalizeMailInboxLimit, normalizeMailSyncInterval } from "@uwe/database/mail-settings";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncBackupScheduleFromSettings } from "@/src/lib/backup-schedule-sync";
import { syncBriefingScheduleFromSettings } from "@/src/lib/briefing-schedule-sync";
import { syncMailScheduleFromSettings } from "@/src/lib/mail-schedule-sync";

function repo() {
  return getAppRepository();
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

export async function updateSettingsAction(formData: FormData) {
  await requireStudioActionAuth();

  const tab = String(formData.get("tab") || "general");
  const update: UweSystemSettingsUpdate = {};

  switch (tab) {
    case "landing":
      update.app = {
        defaultLandingPage: String(formData.get("defaultLandingPage") || "/today").trim() || "/today",
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
      update.auth = {
        sessionInactivityTimeoutMinutes: (() => {
          const minutes = Number.parseInt(
            String(formData.get("sessionInactivityTimeoutMinutes") || "0"),
            10,
          );
          if (!Number.isFinite(minutes)) {
            return 0;
          }
          return Math.max(0, Math.min(24 * 60, Math.round(minutes)));
        })(),
      };
      break;
    case "login":
      update.auth = {
        passkeysEnabled: parseBoolean(formData.get("passkeysEnabled")),
      };
      break;
    case "login-google": {
      // Google client credentials are owner-only (precedent: system/cloudflare).
      await requireOwner();
      const current = await repo().getSystemSettings();
      update.auth = buildGoogleOAuthSettingsUpdate(
        {
          googleLoginEnabled: parseBoolean(formData.get("googleLoginEnabled")),
          googleClientId: String(formData.get("googleClientId") || ""),
          googleClientSecret: String(formData.get("googleClientSecret") || ""),
          clearGoogleClientSecret: parseBoolean(formData.get("clearGoogleClientSecret")),
        },
        current.auth,
      );
      break;
    }
    case "storage":
      update.storage = {
        uploadsPath: String(formData.get("uploadsPath") || ""),
        exportsPath: String(formData.get("exportsPath") || ""),
      };
      break;
    case "ai": {
      const current = await repo().getSystemSettings();
      const providerIds = ["openai", "anthropic", "gemini", "openrouter"] as const;
      let cloudApiKeys: AiProviderStoredKey[] | null = current.ai.cloudApiKeys ?? null;

      for (const providerId of providerIds) {
        const key = String(formData.get(`apiKey_${providerId}`) || "").trim();
        const clear = parseBoolean(formData.get(`clearApiKey_${providerId}`));
        if (clear) {
          cloudApiKeys = buildAiProviderKeyUpdate(providerId, undefined, cloudApiKeys);
        } else if (key) {
          cloudApiKeys = buildAiProviderKeyUpdate(providerId, key, cloudApiKeys);
        }
      }

      update.ai = {
        enabled: parseBoolean(formData.get("aiEnabled")),
        localOnlyMode: parseBoolean(formData.get("localOnlyMode")),
        cloudApiKeys,
      };
      break;
    }
    case "mail": {
      const current = await repo().getSystemSettings();
      const smtpPortRaw = Number.parseInt(String(formData.get("smtpPort") || "587"), 10);
      const smtpPassword = String(formData.get("smtpPassword") || "");
      const clearPortalSmtp = parseBoolean(formData.get("clearPortalSmtp"));
      let smtpCredentials = current.mail.smtpCredentials ?? null;

      if (clearPortalSmtp) {
        smtpCredentials = null;
      } else {
        const smtpHost = String(formData.get("smtpHost") || "").trim();
        const smtpUseMock = parseBoolean(formData.get("smtpUseMock"));
        if (smtpHost || smtpUseMock || current.mail.smtpCredentials) {
          try {
            smtpCredentials = buildMailSmtpCredentialsUpdate({
              host: smtpHost,
              port: Number.isFinite(smtpPortRaw) && smtpPortRaw > 0 ? smtpPortRaw : 587,
              secure: parseBoolean(formData.get("smtpSecure")),
              user: String(formData.get("smtpUser") || ""),
              password: smtpPassword || undefined,
              from: String(formData.get("mailFrom") || ""),
              useMock: smtpUseMock,
              existing: current.mail.smtpCredentials,
            });
          } catch (error) {
            if (error instanceof Error && error.message === "SMTP_PASSWORD_REQUIRED") {
              throw new Error("SMTP-Passwort ist erforderlich (oder bestehendes Passwort beibehalten).");
            }
            throw error;
          }
        }
      }

      update.mail = {
        enabled: parseBoolean(formData.get("mailEnabled")),
        fromDisplayName: String(formData.get("fromDisplayName") || ""),
        logBody: parseBoolean(formData.get("mailLogBody")),
        inboxLimit: normalizeMailInboxLimit(formData.get("inboxLimit")),
        autoSyncEnabled: parseBoolean(formData.get("mailAutoSyncEnabled")),
        autoSyncIntervalMinutes: normalizeMailSyncInterval(
          Number.parseInt(String(formData.get("mailAutoSyncInterval") || "15"), 10),
        ),
        smtpCredentials,
      };
      break;
    }
    case "backup":
      update.backup = {
        backupsPath: String(formData.get("backupsPath") || ""),
        autoBackupEnabled: parseBoolean(formData.get("autoBackupEnabled")),
        retentionCount: (() => {
          const raw = Number.parseInt(String(formData.get("retentionCount") || "14"), 10);
          if (raw === 7 || raw === 30) return raw;
          return 14;
        })(),
      };
      break;
    case "briefing":
      update.briefing = {
        autoBriefingEnabled: parseBoolean(formData.get("autoBriefingEnabled")),
        time: String(formData.get("briefingTime") || "07:00"),
      };
      break;
    case "image-studio":
      update.imageStudio = {
        enabled: parseBoolean(formData.get("imageStudioEnabled")),
        defaultProviderMode: String(
          formData.get("imageStudioDefaultProvider") || "auto",
        ) as "auto" | "local_rtx" | "cloud",
        allowCloud: parseBoolean(formData.get("imageStudioAllowCloud")),
        backgroundRemovalEnabled: parseBoolean(formData.get("imageStudioBgRemoval")),
      };
      break;
    case "maintenance":
      update.maintenance = {
        maintenanceMode: parseBoolean(formData.get("maintenanceMode")),
        lockStudio: parseBoolean(formData.get("lockStudio")),
        lockPortal: parseBoolean(formData.get("lockPortal")),
        message: String(formData.get("maintenanceMessage") || ""),
      };
      break;
    default:
      throw new Error(`Unknown settings tab: ${tab}`);
  }

  // Validate the update through the same guard the PUT /api/settings route uses,
  // so raw enum casts (theme, backgroundPattern, visibility, canonical status,
  // provider mode) and unsafe paths cannot slip into the settings JSON via the
  // server action. The action additionally builds fields the validator does not
  // model (themePreferences / cloudApiKeys / smtpCredentials are assembled by
  // helpers above); strip those from the validation input so they don't trip the
  // unknown-key check, but still persist the original update unchanged.
  const validationInput = structuredClone(update);
  if (validationInput.app) {
    delete (validationInput.app as { themePreferences?: unknown }).themePreferences;
  }
  if (validationInput.ai) {
    delete (validationInput.ai as { cloudApiKeys?: unknown }).cloudApiKeys;
  }
  if (validationInput.mail) {
    delete (validationInput.mail as { smtpCredentials?: unknown }).smtpCredentials;
  }
  if (validationInput.auth) {
    // Assembled server-side by buildGoogleOAuthSettingsUpdate — not client input.
    delete (validationInput.auth as { googleClientSecretEnc?: unknown }).googleClientSecretEnc;
    delete (validationInput.auth as { googleClientSecretConfigured?: unknown })
      .googleClientSecretConfigured;
  }
  const validation = validateSettingsUpdate(validationInput);
  if (!validation.ok) {
    throw new Error(`Ungültige Einstellungen: ${validation.errors.join(" ")}`);
  }

  await repo().updateSystemSettings(update);

  if (update.app?.defaultLandingPage !== undefined) {
    revalidatePath("/");
  }

  if (update.backup) {
    const settings = await repo().getSystemSettings();
    syncBackupScheduleFromSettings(settings.backup);
  }

  if (update.briefing) {
    const settings = await repo().getSystemSettings();
    syncBriefingScheduleFromSettings(settings.briefing);
  }

  if (update.mail) {
    const settings = await repo().getSystemSettings();
    syncMailScheduleFromSettings(settings.mail);
  }

  revalidatePath("/settings");
  const redirectTab =
    tab === "landing" ? "general" : tab === "login-google" ? "login" : tab;
  redirect(`/settings?tab=${redirectTab}&saved=1`);
}

export async function setWorldGuestModeAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldId = String(formData.get("worldId"));
  const enabled = parseBoolean(formData.get("guestModeEnabled"));
  const tab = String(formData.get("tab") || "worlds");

  const auth = createAuthService(prisma);
  await auth.setWorldGuestMode(worldId, enabled);

  revalidatePath("/settings");
  redirect(`/settings?tab=${tab}&saved=1`);
}
