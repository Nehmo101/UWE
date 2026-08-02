import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { requireStudioAccess } from "@/src/lib/auth";
import { ACTIVE_WORLD_COOKIE } from "@/src/lib/active-world";
import { resolveStudioPortalWorldHref } from "@/src/lib/portal-world-redirect";

/** Studio `/portal` → Portal-URL der zuletzt aktiven (oder favorisierten) Welt. */
export default async function StudioPortalRedirectPage() {
  await requireStudioAccess();
  const cookieStore = await cookies();
  // Die Welt, die der Shell gerade führt, schlägt die gespeicherte Vorliebe —
  // „Portal öffnen" soll dort landen, wo gerade gearbeitet wird.
  const activeWorldSlug = cookieStore.get(ACTIVE_WORLD_COOKIE)?.value ?? null;
  redirect(await resolveStudioPortalWorldHref(prisma, activeWorldSlug));
}
