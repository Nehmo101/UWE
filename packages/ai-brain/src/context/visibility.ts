import type { AiTaskType, ContextAudience } from "../types";
import { PLAYER_SAFE_TASKS } from "../types";

const PORTAL_SAFE_VISIBILITIES = new Set(["public", "player_visible"]);

export function resolveContextAudience(
  taskType: AiTaskType,
  explicit?: ContextAudience,
): ContextAudience {
  if (explicit) {
    return explicit;
  }
  if (PLAYER_SAFE_TASKS.includes(taskType)) {
    return "player_visible";
  }
  return "dm_internal";
}

export function audienceAllowsDmOnly(
  audience: ContextAudience,
  allowDmOnlySetting: boolean,
  explicitAllowDmOnly?: boolean,
): boolean {
  if (audience !== "dm_internal") {
    return false;
  }
  if (explicitAllowDmOnly !== undefined) {
    return explicitAllowDmOnly;
  }
  return allowDmOnlySetting;
}

export function shouldIncludeVisibility(
  visibility: string,
  allowDmOnly: boolean,
): boolean {
  if (allowDmOnly) {
    return visibility !== "archived";
  }
  return PORTAL_SAFE_VISIBILITIES.has(visibility);
}

export function filterBrainVisibility<T extends { visibility: string }>(
  entries: T[],
  allowDmOnly: boolean,
): T[] {
  if (allowDmOnly) {
    return entries.filter((entry) => entry.visibility !== "archived");
  }
  return entries.filter((entry) => PORTAL_SAFE_VISIBILITIES.has(entry.visibility));
}
