import type { AiTaskType, ContextAudience } from "../types";
import { PLAYER_SAFE_TASKS } from "../types";

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
