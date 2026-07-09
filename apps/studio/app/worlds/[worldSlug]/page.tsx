import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  resolveWorldLastRoute,
  worldLastRouteCookieName,
} from "@/src/lib/world-last-route";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

/** #639 — World root redirects to dashboard or last-visited sub-route (cookie). */
export default async function StudioWorldRootRedirect({ params }: Props) {
  const { worldSlug } = await params;
  const cookieStore = await cookies();
  const lastRoute = resolveWorldLastRoute(
    worldSlug,
    cookieStore.get(worldLastRouteCookieName(worldSlug))?.value,
  );

  redirect(lastRoute ?? `/worlds/${worldSlug}/dashboard`);
}
