import { resolveStudioSessionHref } from "@uwe/auth";

/** Logged-in Studio dashboard when linking from Portal chrome. */
export function resolvePortalStudioOpenHref(): string {
  return resolveStudioSessionHref(process.env, { currentApp: "portal" });
}
