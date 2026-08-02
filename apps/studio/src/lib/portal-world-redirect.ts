import { resolvePortalPublicBaseUrl, resolveUweAppUrls } from "@uwe/auth";
import type { PrismaClient } from "@uwe/database/server";
import { createSettingsService, getAppRepository } from "@uwe/database/server";

/**
 * Resolve Portal deep-link for the DM's most relevant world
 * (shell world → last active → favorite → first).
 *
 * `preferredSlug` ist die Welt, die der Studio-Shell gerade führt
 * (`uwe_active_world`). Sie steht vor den Einstellungen, weil sie die
 * jüngere Aussage ist: `lastActiveWorldSlug` wird im Studio nirgends
 * geschrieben, „Portal öffnen" landete deshalb bisher immer auf der
 * Favoritenwelt — auch mitten in einer anderen.
 */
export async function resolveStudioPortalWorldHref(
  db: PrismaClient,
  preferredSlug?: string | null,
): Promise<string> {
  const urls = resolveUweAppUrls();
  const portalBase = resolvePortalPublicBaseUrl().replace(/\/$/, "");
  const settings = await createSettingsService(db).getSettings();
  const repo = getAppRepository();

  let worldSlug =
    preferredSlug?.trim() ||
    settings.app.lastActiveWorldSlug?.trim() ||
    settings.app.favoriteWorldSlug?.trim() ||
    "";

  if (worldSlug) {
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) worldSlug = "";
  }

  if (!worldSlug) {
    const worlds = await repo.listWorlds();
    worldSlug = worlds[0]?.slug ?? "";
  }

  const worldPath = worldSlug ? `/auth/worlds/${worldSlug}` : "/auth/worlds";

  if (urls.deploymentModel === "split-hostname") {
    return `${portalBase}${worldPath}`;
  }

  if (urls.portalPath === "/") {
    return `${portalBase}${worldPath}`;
  }

  if (worldSlug) {
    return `${portalBase}${worldPath}`;
  }

  return portalBase.endsWith(urls.portalPath) ? portalBase : `${portalBase}${urls.portalPath}`;
}
