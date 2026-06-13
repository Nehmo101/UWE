import { getSystemSettings, isPublicSharingEnabled } from "@uwe/database/server";
import { getUweRuntimeConfig } from "@uwe/auth";

export async function isShareFeatureEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return isPublicSharingEnabled(settings);
}

export function isShareLinkPasswordRequired(link: { passwordHash: string | null }): boolean {
  const config = getUweRuntimeConfig();
  return config.playerPreviewRequireToken && !link.passwordHash;
}
