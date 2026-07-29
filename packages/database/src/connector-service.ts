/**
 * Connector service — host-side source of truth for the worker registry and
 * the outbound job queue consumed by Maschinenräume.
 *
 * The host never reaches out to a connector. Connectors authenticate with a
 * token (only its hash is stored), send heartbeats, claim jobs that match their
 * effective capabilities, and report results. All scheduling rules live in
 * @uwe/connector.
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
  normalizeLocalPrinters,
  selectNextJob,
  type ClaimableJobView,
  type ConnectorCapability,
  type ConnectorJobType,
  type ConnectorLane,
  type ConnectorModelType,
  type ConnectorStatus,
  type LocalPrinterInfo,
} from "@uwe/connector";

import { Prisma } from "./generated/prisma/client";
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
  /** Effective capabilities used for UI availability and queue eligibility. */
  capabilities: ConnectorCapability[];
  /** Raw normalized capabilities most recently reported by the connector. */
  reportedCapabilities: ConnectorCapability[];
  /** Host/admin allowlist. null means unrestricted for compatibility. */
  allowedCapabilities: ConnectorCapability[] | null;
  models: ConnectorModelInfo[];
  printers: LocalPrinterInfo[];
  version: string | null;
  currentJobs: number;
  lastError: string | null;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorModelInfo {
  /** Stable profile key reported by the connector (P5+); addresses a model. */
  id?: string;
  provider: string;
  name: string;
  status?: string;
  contextLength?: number;
  capabilities?: string[];
  /** Friendly label shown in the host model picker. */
  displayName?: string;
  description?: string;
  /** Short use-case hints reported by the connector. */
  bestFor?: string[];
  modelType?: ConnectorModelType;
  /** True for all models the connector sends — only enabled models are reported. */
  enabledForUwe?: boolean;
}

export interface ConnectorSummary {
  anyOnline: boolean;
  onlineCount: number;
  totalCount: number;
  availableCapabilities: ConnectorCapability[];
  connectors: ConnectorView[];
}

export interface CreatedConnector {
  connector: ConnectorView;
  /** Plaintext token — shown exactly once, never persisted. */
  token: string;
}

export interface HeartbeatInput {
  capabilities?: readonly string[];
  models?: ConnectorModelInfo[];
  printers?: LocalPrinterInfo[];
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
  if (typeof value === "string") {
    try {
      return parseCapabilities(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeCapabilities(value);
}

function parseAllowedCapabilities(value: unknown): ConnectorCapability[] | null {
  if (value == null) {
    return null;
  }
  return parseCapabilities(value);
}

function effectiveCapabilities(
  reported: readonly ConnectorCapability[],
  allowed: readonly ConnectorCapability[] | null,
): ConnectorCapability[] {
  if (allowed == null) {
    return normalizeCapabilities(reported);
  }
  const allowedSet = new Set(allowed);
  return normalizeCapabilities(reported).filter((capability) => allowedSet.has(capability));
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

function parsePrinters(value: unknown): LocalPrinterInfo[] {
  return normalizeLocalPrinters(value);
}

function applyCapabilityPolicy(
  view: ConnectorView,
  policy?: { reportedCapabilities: ConnectorCapability[]; allowedCapabilities: ConnectorCapability[] | null },
): ConnectorView {
  if (!policy) {
    return view;
  }
  return {
    ...view,
    reportedCapabilities: policy.reportedCapabilities,
    allowedCapabilities: policy.allowedCapabilities,
    capabilities: effectiveCapabilities(policy.reportedCapabilities, policy.allowedCapabilities),
  };
}

export function toConnectorView(connector: Connector, now: Date = new Date()): ConnectorView {
  const capabilities = parseCapabilities(connector.capabilities);
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
    capabilities,
    reportedCapabilities: capabilities,
    allowedCapabilities: null,
    models: parseModels(connector.models),
    printers: parsePrinters(connector.printers),
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
        name: name.trim() || "UWE Maschinenraum",
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
    return connectors.map((connector) =>
      applyCapabilityPolicy(toConnectorView(connector, now), {
        reportedCapabilities: parseCapabilities(connector.reportedCapabilities),
        allowedCapabilities: parseAllowedCapabilities(connector.allowedCapabilities),
      }),
    );
  }

  async setDisabled(connectorId: string, disabled: boolean): Promise<void> {
    await this.db.connector.update({ where: { id: connectorId }, data: { disabled } });
  }

  async setAllowedCapabilities(
    connectorId: string,
    capabilities: readonly string[] | null,
  ): Promise<ConnectorView | null> {
    const allowed = capabilities == null ? null : normalizeCapabilities(capabilities);
    const connector = await this.db.connector.findUnique({ where: { id: connectorId } });
    if (!connector) {
      return null;
    }

    const reported = parseCapabilities(connector.reportedCapabilities);
    const effective = effectiveCapabilities(reported, allowed);
    const updated = await this.db.connector.update({
      where: { id: connectorId },
      data: {
        allowedCapabilities: allowed == null ? Prisma.DbNull : toPrismaJsonValue(allowed),
        capabilities: toPrismaJsonValue(effective),
      },
    });

    return applyCapabilityPolicy(toConnectorView(updated), {
      reportedCapabilities: reported,
      allowedCapabilities: allowed,
    });
  }

  /**
   * High-level connector availability for degraded-mode UI. Reports whether any
   * connector is online and which capabilities are currently served.
   */
  async summarize(now: Date = new Date()): Promise<ConnectorSummary> {
    const connectors = await this.listConnectors(now);
    const online = connectors.filter(
      (connector) => connector.status === "online" || connector.status === "degraded",
    );
    const availableCapabilities = new Set<ConnectorCapability>();
    for (const connector of online) {
      for (const capability of connector.capabilities) {
        availableCapabilities.add(capability);
      }
    }
    return {
      anyOnline: online.length > 0,
      onlineCount: online.length,
      totalCount: connectors.length,
      availableCapabilities: [...availableCapabilities],
      connectors,
    };
  }

  capabilityAvailable(summary: ConnectorSummary, capability: ConnectorCapability): boolean {
    return summary.availableCapabilities.includes(capability);
  }

  // --- Heartbeat ---

  async heartbeat(connectorId: string, input: HeartbeatInput): Promise<ConnectorView> {
    const reportedCapabilities =
      input.capabilities != null ? normalizeCapabilities(input.capabilities) : undefined;
    const existing = await this.db.connector.findUnique({
      where: { id: connectorId },
      select: { allowedCapabilities: true },
    });
    const allowedCapabilities = parseAllowedCapabilities(existing?.allowedCapabilities ?? null);
    const capabilities =
      reportedCapabilities != null
        ? effectiveCapabilities(reportedCapabilities, allowedCapabilities)
        : undefined;
    const lastError = input.lastError === undefined ? undefined : input.lastError;

    const connector = await this.db.connector.update({
      where: { id: connectorId },
      data: {
        lastHeartbeatAt: new Date(),
        status: lastError ? "degraded" : "online",
        ...(capabilities ? { capabilities: toPrismaJsonValue(capabilities) } : {}),
        ...(reportedCapabilities !== undefined
          ? { reportedCapabilities: toPrismaJsonValue(reportedCapabilities) }
          : {}),
        ...(input.models !== undefined ? { models: toPrismaJsonValue(input.models) } : {}),
        ...(input.printers !== undefined ? { printers: toPrismaJsonValue(input.printers) } : {}),
        ...(input.version !== undefined ? { version: input.version } : {}),
        ...(input.queueEnabled !== undefined ? { queueEnabled: input.queueEnabled } : {}),
        ...(input.currentJobs !== undefined ? { currentJobs: input.currentJobs } : {}),
        ...(lastError !== undefined ? { lastError } : {}),
      },
    });

    return applyCapabilityPolicy(toConnectorView(connector), {
      reportedCapabilities: reportedCapabilities ?? parseCapabilities(connector.capabilities),
      allowedCapabilities,
    });
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
    const job = await this.db.connectorJob.findUnique({ where: { id: jobId } });
    if (job?.type === "printer_discover" && result?.printers) {
      await this.updatePrinters(connectorId, normalizeLocalPrinters(result.printers));
    }
    return job;
  }

  async updatePrinters(connectorId: string, printers: readonly LocalPrinterInfo[]): Promise<void> {
    await this.db.connector.update({
      where: { id: connectorId },
      data: { printers: toPrismaJsonValue([...printers]) },
    });
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

/** Raised when a connector job fails, expires, is missing, or times out while waiting. */
export class ConnectorJobWaitError extends Error {
  constructor(
    message: string,
    readonly jobId: string,
    readonly status: ConnectorJob["status"] | "missing" | "timeout",
  ) {
    super(message);
    this.name = "ConnectorJobWaitError";
  }
}

export interface WaitForConnectorJobOptions {
  /** Overall budget before giving up. Defaults to 120s. */
  timeoutMs?: number;
  /** Poll interval between status checks. Defaults to 500ms. */
  intervalMs?: number;
  /** Injectable clock (ms epoch) — for deterministic tests. */
  now?: () => number;
  /** Injectable sleep — for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Poll a connector job until it reaches a terminal state. Resolves with the
 * completed job, or throws `ConnectorJobWaitError` on failure/expiry/timeout.
 *
 * The host never executes the job itself — an online Maschinenraum claims
 * and completes it through the queue. This helper only observes the job row.
 */
export async function waitForConnectorJob(
  db: PrismaClient,
  jobId: string,
  options: WaitForConnectorJobOptions = {},
): Promise<ConnectorJob> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 500;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + timeoutMs;

  for (;;) {
    const job = await db.connectorJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new ConnectorJobWaitError(
        `Connector-Job ${jobId} wurde nicht gefunden.`,
        jobId,
        "missing",
      );
    }
    if (job.status === "completed") {
      return job;
    }
    if (job.status === "failed" || job.status === "expired") {
      throw new ConnectorJobWaitError(
        job.failedReason || `Connector-Job ${jobId} endete mit Status "${job.status}".`,
        jobId,
        job.status,
      );
    }
    if (now() >= deadline) {
      throw new ConnectorJobWaitError(
        `Connector-Job ${jobId} hat das Zeitlimit von ${timeoutMs} ms überschritten (Status: ${job.status}).`,
        jobId,
        "timeout",
      );
    }
    await sleep(intervalMs);
  }
}
