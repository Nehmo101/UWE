import { redirect } from "next/navigation";
import { resolvePortalPublicBaseUrl, resolveUweAppUrls } from "@uwe/auth";

/** Defensive shim: Studio `/portal` must never 404 — redirect to configured Portal URL. */
export default function StudioPortalRedirectPage() {
  const urls = resolveUweAppUrls();

  if (urls.deploymentModel === "split-hostname") {
    redirect(resolvePortalPublicBaseUrl());
  }

  if (urls.portalPath === "/") {
    redirect(resolvePortalPublicBaseUrl());
  }

  redirect(urls.portalPath);
}
