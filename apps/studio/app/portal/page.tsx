import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@uwe/database/server";
import { requireStudioAccess } from "@/src/lib/auth";
import { ACTIVE_WORLD_COOKIE, decodeWorldSlugCookie } from "@/src/lib/active-world";
import { resolveStudioPortalWorldHref } from "@/src/lib/portal-world-redirect";

/** Studio `/portal` → Portal-URL der zuletzt aktiven (oder favorisierten) Welt. */
export default async function StudioPortalRedirectPage() {
  await requireStudioAccess();
  const cookieStore = await cookies();
  // Die Welt, die der Shell gerade führt, schlägt die gespeicherte Vorliebe —
  // „Portal öffnen" soll dort landen, wo gerade gearbeitet wird.
  //
  // Dekodiert und auf Slug-Form geprüft, bevor der Wert weitergereicht wird:
  // der Cookie ist Client-Eingabe, und `resolveStudioPortalWorldHref` würde
  // sonst für jeden beliebigen Inhalt eine Welt-Abfrage absetzen.
  const activeWorldSlug = decodeWorldSlugCookie(cookieStore.get(ACTIVE_WORLD_COOKIE)?.value);
  redirect(await resolveStudioPortalWorldHref(prisma, activeWorldSlug));
}
