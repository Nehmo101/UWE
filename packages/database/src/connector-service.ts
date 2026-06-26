/**
 * Connector service — host-side source of truth for the worker registry and
 * the outbound job queue consumed by RTX Host Connectors.
 *
 * The host never reaches out to a connector. Connectors authenticate with a
 * token (only its hash is stored), send heartbeats, claim jobs that match their
 * capabilities, and report results. All scheduling rules live in @uwe/connector.
 */

import {
  capabilityForJobType,
  defaultExpiryForJobType,
  defaultPriorityForJobType,
  deriveConnectorStatus,
  generateConnectorToken,
  hashConnectorToken,
  isConnectorJobType,
  laneForJobType,
  normalizeCapabilities,
  selectNextJob,
  type ClaimableJobView,
  type ConnectorCapability,
  type ConnectorJobType,
  type ConnectorLane,
  type ConnectorStatus,
} from "@uwe/connector";

import type { Connector, ConnectorJob } from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export type { Connector, ConnectorJob } from "./generated/prisma/client";

export interface ConnectorView {
  id: string;
  name: string;
  type: string;
  status: ConnectorStatus;
  disabled: boolean;
  queueEnabled: boolean;
  capabilities: ConnectorCapability[];
  models: ConnectorModelInfo[];
  version: string | null;
  currentJobs: number;
  lastError: string | null;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorModelInfo {
  provider: string;
  name: string;
  status?: string;
  contextLength?: number;
  capabilities?: string[];
}

export interface CreatedConnector {
  connector: ConnectorView;
  /** Plaintext token — shown exactly once, never persisted. */
  token: string;
}

export interface HeartbeatInput {
  capabilities?: readonly string[];
  models?: ConnectorModelInfo[];
  version?: string | null;
  queueEnabled?: boolean;
  currentJobs?: number;
  lastError?: string | null;
}

export interface EnqueueConnectorJobInput {
  type: ConnectorJobType;
  payload?: Record<string, unknown> | null;
  priority?: number;
  worldId?: string | null;
  targetConnectorId?: string | null;
  createdByUserId?: string | null;
  maxRetries?: number;
  expiresAt?: Date | null;
}

export interface ClaimJobInput {
  connectorId: string;
  availableLanes: readonly ConnectorLane[];
}

function parseCapabilities(value: unknown): ConnectorCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeCapabilities(value);
}

function parseModels(value: unknown): ConnectorModelInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is ConnectorModelInfo =>
      typeof entry === "object" &&
      entry != null &&
      typeof (entry as { name?: unknown }).name === "string",
  );
}

export function toConnectorView(connector: Connector, now: Date = new Date()): ConnectorView {
  return {
    id: connector.id,
    name: connector.name,
    type: connector.type,
    status: deriveConnectorStatus(
      {
        lastHeartbeatAt: connector.lastHeartbeatAt,
        queueEnabled: connector.queueEnabled,
        disabled: connector.disabled,
        lastError: connector.lastError,
      },
      now,
    ),
    disabled: connector.disabled,
    queueEnabled: connector.queueEnabled,
    capabilities: parseCapabilities(connector.capabilities),
    models: parseModels(connector.models),
    version: connector.version,
    currentJobs: connector.currentJobs,
    lastError: connector.lastError,
    lastHeartbeatAt: connector.lastHeartbeatAt,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  };
}

export class ConnectorService {
  constructor(private readonly db: PrismaClient) {}

  // --- Registry / tokens ---

  async createConnector(name: string): Promise<CreatedConnector> {
    const token = generateConnectorToken();
    const connector = await this.db.connector.create({
      data: {
        name: name.trim() || "RTX Host Connector",
        tokenHash: hashConnectorToken(token),
      },
    });
    return { connector: toConnectorView(connector), token };
  }

  /** Rotate the token for an existing connector (invalidates the old one). */
  async rotateToken(connectorId: string): Promise<{ token: string }> {
    const token = generateConnectorToken();
    await this.db.connector.update({
      where: { id: connectorId },
      data: { tokenHash: hashConnectorToken(token) },
    });
    return { token };
  }

  async deleteConnector(connectorId: string): Promise<void> {
    await this.db.connector.delete({ where: { id: connectorId } });
  }

  /** Authenticate a raw connector token. Returns the connector or null. */
  async authenticate(rawToken: string): Promise<Connector | null> {
    const trimmed = rawToken.trim();
    if (!trimmed) {
      return null;
    }
    const tokenHash = hashConnectorToken(trimmed);
    return this.db.connector.findUnique({ where: { tokenHash } });
  }

  async getConnector(connectorId: string): Promise<Connector | null> {
    return this.db.connector.findUnique({ where: { id: connectorId } });
  }

  async listConnectors(now: Date = new Date()): Promise<ConnectorView[]> {
    const connectors = await this.db.connector.findMany({ orderBy: { createdAt: "asc" } });
    return connectors.map((connector) => toConnectorView(connector, now));
  }

  async setDisabled(connectorId: string, disabled: boolean): Promise<void> {
    await this.db.connector.update({ where: { id: connectorId }, data: { disabled } });
  }

  // --- Heartbeat ---

  async heartbeat(connectorId: string, input: HeartbeatInput): Promise<ConnectorView> {
    const capabilities =
      input.capabilities != null ? normalizeCapabilities(input.capabilities) : undefined;
    const lastError = input.lastError === undefined ? undefined : input.lastError;

    const connector = await this.db.connector.update({
      where: { id: connectorId },
      data: {
        lastHeartbeatAt: new Date(),
        status: lastError ? "degraded" : "online",
        ...(capabilities ? { capabilities: toPrismaJsonValue(capabilities) } : {}),
        ...(input.models !== undefined ? { models: toPrismaJsonValue(input.models) } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.queueEnabled !== undefined ? { queueEnabled: input.queueEnabled } : {}),
        ...(input.currentJobs !== undefined ? { currentJobs: input.currentJobs } : {}),
        ...(lastError !== undefined ? { lastError } : {}),
      },
    });
    return toConnectorView(connector);
  }

  /** Mark connectors offline whose heartbeat window has elapsed (sweep). */
  async markStaleOffline(olderThanMs = 45_000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await this.db.connector.updateMany({
      where: {
        disabled: false,
        status: { in: ["online", "degraded"] },
        OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: cutoff } }],
      },
      data: { status: "offline" },
    });
    return result.count;
  }

  // --- Queue ---

  async enqueueJob(input: EnqueueConnectorJobInput): Promise<ConnectorJob> {
    const lane = laneForJobType(input.type);
    const priority = input.priority ?? defaultPriorityForJobType(input.type);
    const capability = capabilityForJobType(input.type);
    const expiresAt = input.expiresAt ?? defaultExpiryForJobType(input.type);

    return this.db.connectorJob.create({
      data: {
        type: input.type,
        lane,
        priority,
        targetCapability: capability,
        targetConnectorId: input.targetConnectorId ?? null,
        worldId: input.worldId ?? null,
        createdByUserId: input.createdByUserId ?? null,
        maxRetries: input.maxRetries ?? 0,
        payload: toPrismaJsonValue(input.payload ?? null),
        expiresAt,
      },
    });
  }

  /**
   * Claim the next eligible job for a connector. Uses an optimistic update so
   * concurrent claims cannot grab the same job. Returns null when nothing is
   * claimable. Expired pending jobs are swept first.
   */
  async claimJob(input: ClaimJobInput): Promise<ConnectorJob | null> {
    const connector = await this.db.connector.findUnique({ where: { id: input.connectorId } });
    if (!connector || connector.disabled || !connector.queueEnabled) {
      return null;
    }
    const capabilities = parseCapabilities(connector.capabilities);
    if (capabilities.length === 0 || input.availableLanes.length === 0) {
      return null;
    }

    await this.expireStaleJobs();

    // Candidate pending jobs in the lanes/capabilities this connector serves.
    const candidates = await this.db.connectorJob.findMany({
      where: {
        status: "pending",
        lane: { in: [...input.availableLanes] },
        targetCapability: { in: capabilities },
        OR: [{ targetConnectorId: null }, { targetConnectorId: input.connectorId }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 25,
    });

    const claimViews: ClaimableJobView[] = candidates
      .filter((job) => isConnectorJobType(job.type))
      .map((job) => ({
        id: job.id,
        type: job.type as ConnectorJobType,
        priority: job.priority,
        lane: job.lane as ConnectorLane,
        targetConnectorId: job.targetConnectorId,
        targetCapability: job.targetCapability as ConnectorCapability,
        createdAt: job.createdAt,
      }));

    const choice = selectNextJob(claimViews, {
      connectorId: input.connectorId,
      capabilities,
      availableLanes: input.availableLanes,
    });
    if (!choice) {
      return null;
    }

    // Optimistic claim: only succeeds if still pending.
    const now = new Date();
    const claimed = await this.db.connectorJob.updateMany({
      where: { id: choice.id, status: "pending" },
      data: {
        status: "claimed",
        claimedByConnectorId: input.connectorId,
        claimedAt: now,
      },
    });
    if (claimed.count === 0) {
      // Lost the race — let the connector poll again.
      return null;
    }

    return this.db.connectorJob.findUnique({ where: { id: choice.id } });
  }

  async startJob(jobId: string, connectorId: string): Promise<ConnectorJob | null> {
    const result = await this.db.connectorJob.updateMany({
      where: { id: jobId, claimedByConnectorId: connectorId, status: "claimed" },
      data: { status: "running", startedAt: new Date() },
    });
    if (result.count === 0) {
      return null;
    }
    return this.db.connectorJob.findUnique({ where: { id: jobId } });
  }

  async completeJob(
    jobId: string,
    connectorId: string,
    result: Record<string, unknown> | null,
  ): Promise<ConnectorJob | null> {
    const updated = await this.db.connectorJob.updateMany({
      where: {
        id: jobId,
        claimedByConnectorId: connectorId,
        status: { in: ["claimed", "running"] },
      },
      data: {
        status: "completed",
        result: toPrismaJsonValue(result ?? {}),
        completedAt: new Date(),
        failedReason: null,
      },
    });
    if (updated.count === 0) {
      return null;
    }
    return this.db.connectorJob.findUnique({ where: { id: jobId } });
  }

  async failJob(
    jobId: string,
    connectorId: string,
    reason: string,
  ): Promise<ConnectorJob | null> {
    const job = await this.db.connectorJob.findFirst({
      where: { id: jobId, claimedByConnectorId: connectorId },
    });
    if (!job || (job.status !== "claimed" && job.status !== "running")) {
      return null;
    }

    // Retry by re-queuing if retries remain; otherwise mark failed.
    if (job.retryCount < job.maxRetries) {
      return this.db.connectorJob.update({
        where: { id: jobId },
        data: {
          status: "pending",
          claimedByConnectorId: null,
          claimedAt: null,
          startedAt: null,
          retryCount: { increment: 1 },
          failedReason: reason.slice(0, 1000),
        },
      });
    }

    return this.db.connectorJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        failedReason: reason.slice(0, 1000),
        completedAt: new Date(),
      },
    });
  }

  /** Mark pending/claimed jobs past their expiry as expired. */
  async expireStaleJobs(now: Date = new Date()): Promise<number> {
    const result = await this.db.connectorJob.updateMany({
      where: {
        status: { in: ["pending", "claimed", "running"] },
        expiresAt: { not: null, lte: now },
      },
      data: { status: "expired", completedAt: now, failedReason: "Job ist abgelaufen (Timeout)." },
    });
    return result.count;
  }

  async listJobs(options: { status?: ConnectorJob["status"]; limit?: number } = {}) {
    return this.db.connectorJob.findMany({
      where: options.status ? { status: options.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
    });
  }

  async listActiveJobs(connectorId: string) {
    return this.db.connectorJob.findMany({
      where: {
        claimedByConnectorId: connectorId,
        status: { in: ["claimed", "running"] },
      },
      orderBy: { claimedAt: "asc" },
    });
  }

  async countPendingByLane(): Promise<Record<string, number>> {
    const grouped = await this.db.connectorJob.groupBy({
      by: ["lane"],
      where: { status: "pending" },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      counts[row.lane] = row._count._all;
    }
    return counts;
  }
}

export function createConnectorService(db: PrismaClient): ConnectorService {
  return new ConnectorService(db);
}
