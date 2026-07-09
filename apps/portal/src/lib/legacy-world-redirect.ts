import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { buildPortalLoginUrl } from "@/src/lib/portal-redirect";

export async function redirectLegacyWorldsHub(): Promise<never> {
  const user = await getCurrentUser();
  if (user) redirect("/auth/worlds");
  redirect(buildPortalLoginUrl("/auth/worlds"));
}

export async function redirectLegacyWorldPath(worldSlug: string, suffix = ""): Promise<never> {
  const target = `/auth/worlds/${worldSlug}${suffix}`;
  const user = await getCurrentUser();
  if (user) redirect(target);
  redirect(buildPortalLoginUrl(target));
}
