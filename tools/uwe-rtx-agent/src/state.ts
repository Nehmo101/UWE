import fs from "node:fs";

import { ensureAgentDataDir, getAgentStatePath } from "./paths.js";

export interface AgentPersistedState {
  enabled: boolean;
  lastHealthCheckAt?: string;
}

function defaultState(): AgentPersistedState {
  return { enabled: true };
}

export function loadPersistedState(): AgentPersistedState {
  ensureAgentDataDir();
  const statePath = getAgentStatePath();
  if (!fs.existsSync(statePath)) {
    return defaultState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as Partial<AgentPersistedState>;
    return {
      enabled: parsed.enabled !== false,
      lastHealthCheckAt:
        typeof parsed.lastHealthCheckAt === "string" ? parsed.lastHealthCheckAt : undefined,
    };
  } catch {
    return defaultState();
  }
}

export function savePersistedState(state: AgentPersistedState): void {
  ensureAgentDataDir();
  fs.writeFileSync(getAgentStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function setPersistedEnabled(enabled: boolean): AgentPersistedState {
  const state = loadPersistedState();
  state.enabled = enabled;
  savePersistedState(state);
  return state;
}

export function touchHealthCheckTimestamp(): AgentPersistedState {
  const state = loadPersistedState();
  state.lastHealthCheckAt = new Date().toISOString();
  savePersistedState(state);
  return state;
}
