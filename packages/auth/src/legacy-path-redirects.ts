import { isSplitHostnameDeployment, resolveUweAppUrls } from "./runtime-config";

export interface LegacyPathRedirect {
  /** Absolute or site-relative redirect target. */
  destination: string;
  /** True when destination is on another origin (e.g. Studio subdomain). */
  external: boolean;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeading.replace(/\/+$/, "") || "/";
}

/**
 * Resolve a permanent redirect for legacy unified-path URLs when UWE runs on
 * split hostnames (Portal root + Studio subdomain).
 *
 * Returns null when no redirect applies (unified-path or local dev).
 */
export function resolveLegacyPathRedirect(
  pathname: string,
  surface: "portal" | "studio",
  env: NodeJS.ProcessEnv = process.env,
): LegacyPathRedirect | null {
  if (!isSplitHostnameDeployment(env)) {
    return null;
  }

  const normalized = normalizePathname(pathname);
  const urls = resolveUweAppUrls(env);

  if (surface === "portal") {
    const studioBase = urls.studioUrl?.replace(/\/$/, "");
    if (!studioBase) {
      return null;
    }

    if (normalized === "/studio") {
      return { destination: studioBase, external: true };
    }
    if (normalized.startsWith("/studio/")) {
      const suffix = normalized.slice("/studio".length) || "/";
      return {
        destination: `${studioBase}${suffix.startsWith("/") ? suffix : `/${suffix}`}`,
        external: true,
      };
    }

    if (normalized === "/portal") {
      return { destination: "/auth/worlds", external: false };
    }
    if (normalized.startsWith("/portal/")) {
      const stripped = normalized.slice("/portal".length) || "/";
      return { destination: stripped.startsWith("/") ? stripped : `/${stripped}`, external: false };
    }
  }

  if (surface === "studio") {
    if (normalized === "/studio") {
      return { destination: "/", external: false };
    }
    if (normalized.startsWith("/studio/")) {
      const stripped = normalized.slice("/studio".length) || "/";
      return { destination: stripped.startsWith("/") ? stripped : `/${stripped}`, external: false };
    }
  }

  return null;
}
