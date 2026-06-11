import { getSystemSettings, isPublicSharingEnabled } from "@uwe/database/server";

export async function isShareFeatureEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return isPublicSharingEnabled(settings);
}
