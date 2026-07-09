import { redirect } from "next/navigation";
import { getCurrentUser, listAuthWorlds } from "@/src/lib/auth";
import { buildPortalLoginUrl } from "@/src/lib/portal-redirect";

export default async function PortalEntryPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(buildPortalLoginUrl("/auth/worlds"));
  }

  const worlds = await listAuthWorlds();

  if (worlds.length === 1) {
    redirect(`/auth/worlds/${worlds[0]!.slug}`);
  }

  redirect("/auth/worlds");
}
