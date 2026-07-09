import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { requireStudioAccess } from "@/src/lib/auth";
import { resolveStudioPortalWorldHref } from "@/src/lib/portal-world-redirect";

/** Studio `/portal` → Portal-URL der zuletzt aktiven (oder favorisierten) Welt. */
export default async function StudioPortalRedirectPage() {
  await requireStudioAccess();
  redirect(await resolveStudioPortalWorldHref(prisma));
}
