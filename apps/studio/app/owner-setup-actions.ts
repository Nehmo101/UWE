"use server";

import {
  buildMailSmtpCredentialsUpdate,
  getAppRepository,
  type UweSystemSettingsUpdate,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/src/lib/auth";
import { syncBackupScheduleFromSettings } from "@/src/lib/backup-schedule-sync";

function repo() {
  return getAppRepository();
}

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function setupRedirect(tab: string) {
  revalidatePath("/admin/setup");
  redirect(`/admin/setup?tab=${tab}&saved=1`);
}

export async function updateOwnerSetupAction(formData: FormData) {
  await requireOwner();

  const tab = String(formData.get("tab") || "system");
  const update: UweSystemSettingsUpdate = {};

  switch (tab) {
    case "system": {
      update.storage = {
        uploadsPath: String(formData.get("uploadsPath") || ""),
        exportsPath: String(formData.get("exportsPath") || ""),
      };
      update.backup = {
        backupsPath: String(formData.get("backupsPath") || ""),
        autoBackupEnabled: parseBoolean(formData.get("autoBackupEnabled")),
      };
      break;
    }
    case "access": {
      update.portal = {
        portalEnabled: parseBoolean(formData.get("portalEnabled")),
        guestAccessEnabled: parseBoolean(formData.get("guestAccessEnabled")),
        publicSharingEnabled: parseBoolean(formData.get("publicSharingEnabled")),
      };
      update.auth = {
        sessionInactivityTimeoutMinutes: (() => {
          const minutes = Number.parseInt(
            String(formData.get("sessionInactivityTimeoutMinutes") || "0"),
            10,
          );
          if (!Number.isFinite(minutes)) return 0;
          return Math.max(0, Math.min(24 * 60, Math.round(minutes)));
        })(),
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
        smtpCredentials,
      };
      break;
    }
    default:
      throw new Error(`Unbekannter Setup-Tab: ${tab}`);
  }

  await repo().updateSystemSettings(update);
  if (update.backup) {
    const settings = await repo().getSystemSettings();
    syncBackupScheduleFromSettings(settings.backup);
  }
  setupRedirect(tab);
}
