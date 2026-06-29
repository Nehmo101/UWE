import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";

export async function redirectLegacyWorldsHub(): Promise<never> {
  const user = await getCurrentUser();
  if (user) redirect("/auth/worlds");
  redirect("/login?redirect=/auth/worlds");
}

export async function redirectLegacyWorldPath(worldSlug: string, suffix = ""): Promise<never> {
  const target = `/auth/worlds/${worldSlug}${suffix}`;
  const user = await getCurrentUser();
  if (user) redirect(target);
  redirect(`/login?redirect=${encodeURIComponent(target)}`);
}
