/**
 * Outbound HTTP client to the UWE Host. This is the ONLY direction of
 * communication — the host never connects to the connector. All requests carry
 * the connector token as a bearer header.
 */

import type { ConnectorCapability, ConnectorLane } from "@uwe/connector";

export interface ConnectorModelInfo {
  provider: string;
  name: string;
  status?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface HostConfig {
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  queueEnabled: boolean;
  cloudFallbackAllowed: boolean;
  capabilities: string[];
  jobTypes: string[];
}

export interface HeartbeatPayload {
  capabilities: ConnectorCapability[];
  models: ConnectorModelInfo[];
  version: string;
  queueEnabled: boolean;
  currentJobs: number;
  lastError: string | null;
}

export interface HeartbeatResponse {
  connector: { id: string; name: string; status: string; queueEnabled: boolean };
  config: HostConfig;
  activeJobIds: string[];
}

export interface ClaimedJob {
  id: string;
  type: string;
  lane: ConnectorLane;
  priority: number;
  payload: Record<string, unknown>;
  worldId: string | null;
  expiresAt: string | null;
}

export class HostClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HostClientError";
  }
}

export class HostClient {
  constructor(
    private readonly hostUrl: string,
    private readonly token: string,
    private readonly requestTimeoutMs = 10_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.hostUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new HostClientError(
        error instanceof Error ? `Host nicht erreichbar: ${error.message}` : "Host nicht erreichbar",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new HostClientError("Host hat das Connector-Token abgelehnt.", response.status);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new HostClientError(`Host antwortet HTTP ${response.status}: ${body.slice(0, 200)}`, response.status);
    }
    return (await response.json()) as T;
  }

  heartbeat(payload: HeartbeatPayload): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>("/api/connectors/heartbeat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async claimJob(availableLanes: ConnectorLane[]): Promise<ClaimedJob | null> {
    const result = await this.request<{ job: ClaimedJob | null }>("/api/connectors/claim-job", {
      method: "POST",
      body: JSON.stringify({ availableLanes }),
    });
    return result.job;
  }

  completeJob(jobId: string, result: Record<string, unknown>): Promise<unknown> {
    return this.request(`/api/connectors/jobs/${encodeURIComponent(jobId)}/complete`, {
      method: "POST",
      body: JSON.stringify({ result }),
    });
  }

  failJob(jobId: string, reason: string): Promise<unknown> {
    return this.request(`/api/connectors/jobs/${encodeURIComponent(jobId)}/fail`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  getConfig(): Promise<{ config: HostConfig }> {
    return this.request<{ config: HostConfig }>("/api/connectors/config");
  }
}
