import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { buildPortalLoginUrl } from "@/src/lib/portal-redirect";

export async function redirectLegacyWorldsHub(): Promise<never> {
  const user = await getCurrentUser();
  if (user) redirect("/auth/worlds");
  redirect(buildPortalLoginUrl("/auth/worlds"));
}

/**
 * Legacy-Pfade wie /worlds/[worldSlug]/[category]/[slug] verwerfen das
 * category-Segment bewusst: Page-Slugs sind pro Welt global eindeutig
 * (@@unique([worldId, slug]) im Prisma-Schema), alte Links bleiben also
 * kollisionsfrei auflösbar. Die Redirects sind absichtlich temporär,
 * weil das Ziel vom Login-Zustand abhängt.
 */
export async function redirectLegacyWorldPath(worldSlug: string, suffix = ""): Promise<never> {
  const target = `/auth/worlds/${worldSlug}${suffix}`;
  const user = await getCurrentUser();
  if (user) redirect(target);
  redirect(buildPortalLoginUrl(target));
}
