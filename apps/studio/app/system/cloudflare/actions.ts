"use server";

import { SettingsService, prisma } from "@uwe/database/server";
import {
  buildDeploymentSettingsUpdate,
  type BrainExposure,
  type DeploymentOverride,
  type DeploymentSettingsInput,
} from "@uwe/database/deployment";
import { parseListInput } from "@uwe/cloudflare-edge";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/src/lib/auth";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { syncManagedChallengeFromSettings } from "@/src/lib/cloudflare-challenge-sync";

function parseOverride(value: FormDataEntryValue | null): DeploymentOverride {
  return value === "on" || value === "off" ? value : "env";
}

function parseText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

// Anything unrecognised falls back to the safe default (loopback).
function parseBrainExposure(value: FormDataEntryValue | null): BrainExposure {
  return value === "lan" || value === "public" || value === "off" ? value : "loopback";
}

// Anything but the explicit strict choice falls back to Cloudflare's adaptive check.
function parseChallengeAction(value: FormDataEntryValue | null): string {
  return value === "js_challenge" ? "js_challenge" : "managed_challenge";
}

function parseList(value: FormDataEntryValue | null): string[] {
  return parseListInput(typeof value === "string" ? value : "");
}

/**
 * Condenses the edge sync into one redirect flag, so a save that could not reach
 * Cloudflare never looks like a success.
 */
function challengeSyncStatus(
  applied: Awaited<ReturnType<typeof syncManagedChallengeFromSettings>>["applied"],
): "saved" | "pending" | "failed" {
  if (applied === null) return "pending";
  return applied.ok ? "saved" : "failed";
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
    managedChallengeEnabled: parseCheckbox(formData.get("managedChallengeEnabled")),
    managedChallengeHostnames: parseList(formData.get("managedChallengeHostnames")),
    managedChallengeSkipPaths: parseList(formData.get("managedChallengeSkipPaths")),
    managedChallengeAction: parseChallengeAction(formData.get("managedChallengeAction")),
    cloudflareZoneId: parseText(formData.get("cloudflareZoneId")),
    cloudflareApiToken: parseText(formData.get("cloudflareApiToken")),
    clearCloudflareApiToken: parseCheckbox(formData.get("clearCloudflareApiToken")),
  };

  const deployment = buildDeploymentSettingsUpdate(input, current.deployment);
  // updateSettings refreshes the in-process runtime-config overlay for us.
  await service.updateSettings({ deployment });

  // Push the Managed Challenge to the edge right away — the whole point of the
  // self-service pattern is that no dashboard or host step follows a save.
  const { applied } = await syncManagedChallengeFromSettings(deployment);

  revalidatePath("/system/cloudflare");
  redirect(`/system/cloudflare?saved=1&challenge=${challengeSyncStatus(applied)}`);
}

/** Re-applies the stored desired state to Cloudflare without changing settings. */
export async function reapplyManagedChallengeAction(): Promise<void> {
  await requireStudioActionAuth();
  await requireOwner();

  const settings = await new SettingsService(prisma).getSettings();
  const { applied } = await syncManagedChallengeFromSettings(settings.deployment);

  revalidatePath("/system/cloudflare");
  redirect(`/system/cloudflare?challenge=${challengeSyncStatus(applied)}`);
}
