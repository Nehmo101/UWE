import type { AgentJobsDispatchConfig } from "./index";

/** Normalized DevAgentJob-compatible status derived from a Cursor agent status. */
export type CursorMappedStatus = "running" | "completed" | "failed";

export interface CursorAgentStatus {
  id: string | null;
  /** Raw Cursor status string (e.g. RUNNING, FINISHED, ERROR). */
  status: string | null;
  branchName: string | null;
  prUrl: string | null;
  url: string | null;
  summary: string | null;
}

interface CursorAgentResponse {
  id?: string;
  status?: string;
  summary?: string;
  // Newer API nests branch/PR under `target`; older shapes used top-level fields.
  target?: {
    branchName?: string;
    prUrl?: string;
    url?: string;
  };
  branchName?: string;
  prUrl?: string;
}

/**
 * Map a Cursor Cloud agent status string onto a DevAgentJob lifecycle status.
 * Unknown / in-flight states (CREATING, PENDING, RUNNING, …) stay `running`.
 */
export function mapCursorStatusToDevAgentStatus(
  status: string | null | undefined,
): CursorMappedStatus {
  switch ((status ?? "").toUpperCase()) {
    case "FINISHED":
    case "COMPLETED":
    case "SUCCESS":
      return "completed";
    case "ERROR":
    case "FAILED":
    case "EXPIRED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    default:
      return "running";
  }
}

/**
 * Fetch the current status of a Cursor Cloud (Background) agent via
 * `GET {cursorCloudApiUrl}/{id}`. Requires a Background-Agent-capable API key.
 */
export async function fetchCursorAgentStatus(
  agentId: string,
  config: AgentJobsDispatchConfig,
): Promise<CursorAgentStatus> {
  if (!config.cursorCloudApiKey) {
    throw new Error("CURSOR_CLOUD_API_KEY nicht gesetzt.");
  }

  const base = config.cursorCloudApiUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}/${encodeURIComponent(agentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.cursorCloudApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Cursor Agent Status Fehler (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as CursorAgentResponse;

  return {
    id: data.id ?? null,
    status: data.status ?? null,
    branchName: data.target?.branchName ?? data.branchName ?? null,
    prUrl: data.target?.prUrl ?? data.prUrl ?? null,
    url: data.target?.url ?? null,
    summary: data.summary ?? null,
  };
}
