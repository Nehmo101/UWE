import { resolveUweAppUrls } from "@uwe/auth";

const DEFAULT_STUDIO_PATH = "/studio";

/**
 * Normalize a Studio API path to `/api/...`.
 */
export function normalizeStudioApiPath(apiPath: string): string {
  const trimmed = apiPath.trim();
  if (!trimmed) return "/api";
  if (trimmed.startsWith("/api/") || trimmed === "/api") return trimmed;
  if (trimmed.startsWith("api/")) return `/${trimmed}`;
  return trimmed.startsWith("/") ? `/api${trimmed}` : `/api/${trimmed}`;
}

function normalizePathPrefix(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") return fallback;
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, "") || fallback;
}

function studioPathFromPublicUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const pathname = new URL(trimmed).pathname.replace(/\/$/, "");
    if (pathname && pathname !== "/") {
      return pathname;
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}

function readUnifiedStudioPathPrefix(env: Record<string, string | undefined>): string | null {
  const explicitStudio = env.NEXT_PUBLIC_STUDIO_URL?.trim();
  const explicitPortal = env.NEXT_PUBLIC_PORTAL_URL?.trim();

  if (explicitStudio && explicitPortal) {
    return studioPathFromPublicUrl(explicitStudio);
  }

  const urls = resolveUweAppUrls(env as NodeJS.ProcessEnv);
  if (urls.publicBaseUrl) {
    return urls.studioPath;
  }

  const publicStudioPath = env.NEXT_PUBLIC_STUDIO_PATH?.trim();
  if (publicStudioPath) {
    return normalizePathPrefix(publicStudioPath, DEFAULT_STUDIO_PATH);
  }

  return null;
}

function detectBrowserStudioPathPrefix(env: Record<string, string | undefined>): string | null {
  if (typeof window === "undefined") return null;

  const candidates = [
    env.NEXT_PUBLIC_STUDIO_PATH?.trim(),
    DEFAULT_STUDIO_PATH,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const prefix = normalizePathPrefix(candidate, DEFAULT_STUDIO_PATH);
    const { pathname } = window.location;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }

  return null;
}

/**
 * Resolve a Studio API URL for browser `fetch()` and other frontend callers.
 *
 * - Direct dev (`localhost:3000`): `/api/...`
 * - Unified reverse proxy: `/studio/api/...`
 * - Explicit origin (`NEXT_PUBLIC_STUDIO_API_ORIGIN`): absolute URL
 */
export function studioApiUrl(
  apiPath: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const normalized = normalizeStudioApiPath(apiPath);

  const apiOrigin = env.NEXT_PUBLIC_STUDIO_API_ORIGIN?.trim()?.replace(/\/$/, "");
  if (apiOrigin) {
    return `${apiOrigin}${normalized}`;
  }

  const prefix =
    readUnifiedStudioPathPrefix(env) ?? detectBrowserStudioPathPrefix(env);
  if (prefix) {
    return `${prefix}${normalized}`;
  }

  return normalized;
}
