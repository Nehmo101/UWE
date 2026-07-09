export const PORTAL_WORLD_VISITS_STORAGE_KEY = "uwe.portal.worldVisits";

export type PortalWorldVisitMap = Record<string, string>;

export function readPortalWorldVisits(): PortalWorldVisitMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PORTAL_WORLD_VISITS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const visits: PortalWorldVisitMap = {};
    for (const [worldId, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        visits[worldId] = value;
      }
    }
    return visits;
  } catch {
    return {};
  }
}

export function writePortalWorldVisit(worldId: string, visitedAt = new Date()): void {
  if (typeof window === "undefined") {
    return;
  }

  const visits = readPortalWorldVisits();
  visits[worldId] = visitedAt.toISOString();

  try {
    window.localStorage.setItem(PORTAL_WORLD_VISITS_STORAGE_KEY, JSON.stringify(visits));
  } catch {
    // Storage may be unavailable in private mode — badge is best-effort.
  }
}

export function isWorldNewSinceLastVisit(
  worldUpdatedAtIso: string,
  lastVisitIso: string | undefined,
): boolean {
  if (!lastVisitIso) {
    return false;
  }

  const worldUpdatedAt = Date.parse(worldUpdatedAtIso);
  const lastVisit = Date.parse(lastVisitIso);
  if (!Number.isFinite(worldUpdatedAt) || !Number.isFinite(lastVisit)) {
    return false;
  }

  return worldUpdatedAt > lastVisit;
}
