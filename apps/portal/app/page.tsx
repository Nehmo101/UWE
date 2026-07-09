import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/auth";
import { buildPortalLoginUrl, sanitizePortalRedirectPath } from "@/src/lib/portal-redirect";

interface Props {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LandingPage({ searchParams }: Props) {
  const { redirect: redirectParam } = await searchParams;
  const destination = sanitizePortalRedirectPath(redirectParam);

  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect(buildPortalLoginUrl(destination));
  }

  if (user) {
    redirect(destination);
  }

  redirect(buildPortalLoginUrl(destination));
}
