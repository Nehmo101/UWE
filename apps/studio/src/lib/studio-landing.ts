import {
  STUDIO_LANDING_PAGE_PATHS,
  type StudioLandingPagePath,
} from "@uwe/database/settings-service";

export const STUDIO_LANDING_PAGE_OPTIONS = [
  { path: "/worlds", label: "Welten" },
  { path: "/continue", label: "Mach weiter" },
  { path: "/capture", label: "Capture-Inbox" },
] as const satisfies ReadonlyArray<{ path: StudioLandingPagePath; label: string }>;

export type { StudioLandingPagePath };

const ALLOWED = new Set<string>(STUDIO_LANDING_PAGE_PATHS);

export function normalizeStudioLandingPage(value: string | null | undefined): StudioLandingPagePath {
  const trimmed = value?.trim();
  if (trimmed && ALLOWED.has(trimmed)) {
    return trimmed as StudioLandingPagePath;
  }
  return "/worlds";
}

export function resolveStudioLandingPath(
  defaultLandingPage: string | null | undefined,
): StudioLandingPagePath {
  return normalizeStudioLandingPage(defaultLandingPage);
}
