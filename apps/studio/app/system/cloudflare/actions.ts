"use server";

import { SettingsService, prisma } from "@uwe/database/server";
import {
  buildDeploymentSettingsUpdate,
  type BrainExposure,
  type DeploymentOverride,
  type DeploymentSettingsInput,
} from "@uwe/database/deployment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/src/lib/auth";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";

function parseOverride(value: FormDataEntryValue | null): DeploymentOverride {
  return value === "on" || value === "off" ? value : "env";
}

function parseText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

// Brain is never public — only loopback/lan/off are accepted; anything else is loopback.
function parseBrainExposure(value: FormDataEntryValue | null): BrainExposure {
  return value === "lan" || value === "off" ? value : "loopback";
}

export async function updateDeploymentConfigAction(formData: FormData): Promise<void> {
  await requireStudioActionAuth();
  await requireOwner();

  const service = new SettingsService(prisma);
  const current = await service.getSettings();

  const input: DeploymentSettingsInput = {
    publicAppUrl: parseText(formData.get("publicAppUrl")),
    studioUrl: parseText(formData.get("studioUrl")),
    portalUrl: parseText(formData.get("portalUrl")),
    studioPath: parseText(formData.get("studioPath")),
    portalPath: parseText(formData.get("portalPath")),
    trustProxy: parseOverride(formData.get("trustProxy")),
    cloudflareTunnel: parseOverride(formData.get("cloudflareTunnel")),
    authRequired: parseOverride(formData.get("authRequired")),
    sessionCookieSecure: parseOverride(formData.get("sessionCookieSecure")),
    playerPreviewPublic: parseOverride(formData.get("playerPreviewPublic")),
    turnstileEnabled: parseOverride(formData.get("turnstileEnabled")),
    turnstileSiteKey: parseText(formData.get("turnstileSiteKey")),
    turnstileSecret: parseText(formData.get("turnstileSecret")),
    clearTurnstileSecret: parseCheckbox(formData.get("clearTurnstileSecret")),
    brainUrl: parseText(formData.get("brainUrl")),
    brainPath: parseText(formData.get("brainPath")),
    brainExposure: parseBrainExposure(formData.get("brainExposure")),
  };

  const deployment = buildDeploymentSettingsUpdate(input, current.deployment);
  // updateSettings refreshes the in-process runtime-config overlay for us.
  await service.updateSettings({ deployment });

  revalidatePath("/system/cloudflare");
  redirect("/system/cloudflare?saved=1");
}
