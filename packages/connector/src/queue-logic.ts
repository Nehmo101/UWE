/**
 * Pure queue logic shared by the host queue service and the connector client.
 * No DB or IO here — just the rules for status derivation, claim eligibility
 * and lane scheduling. Kept pure so it is trivially testable.
 */

import type { ConnectorCapability } from "./capabilities";
import {
  CONNECTOR_JOB_DESCRIPTORS,
  type ConnectorJobType,
  type ConnectorLane,
} from "./job-types";

export const CONNECTOR_STATUSES = ["online", "offline", "degraded", "disabled"] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const CONNECTOR_JOB_STATUSES = [
  "pending",
  "claimed",
  "running",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;
export type ConnectorJobStatus = (typeof CONNECTOR_JOB_STATUSES)[number];

/** A connector is considered online if it sent a heartbeat recently. */
export const DEFAULT_ONLINE_WINDOW_MS = 45_000;

export interface ConnectorHeartbeatView {
  lastHeartbeatAt: Date | null;
  queueEnabled: boolean;
  disabled: boolean;
  lastError?: string | null;
}

export function deriveConnectorStatus(
  connector: ConnectorHeartbeatView,
  now: Date = new Date(),
  onlineWindowMs: number = DEFAULT_ONLINE_WINDOW_MS,
): ConnectorStatus {
  if (connector.disabled) {
    return "disabled";
  }
  if (!connector.lastHeartbeatAt) {
    return "offline";
  }
  const age = now.getTime() - connector.lastHeartbeatAt.getTime();
  if (age > onlineWindowMs) {
    return "offline";
  }
  if (connector.lastError) {
    return "degraded";
  }
  return "online";
}

export function isConnectorOnline(
  connector: ConnectorHeartbeatView,
  now: Date = new Date(),
  onlineWindowMs: number = DEFAULT_ONLINE_WINDOW_MS,
): boolean {
  const status = deriveConnectorStatus(connector, now, onlineWindowMs);
  return status === "online" || status === "degraded";
}

export interface ClaimableJobView {
  id: string;
  type: ConnectorJobType;
  priority: number;
  lane: ConnectorLane;
  targetConnectorId: string | null;
  targetCapability: ConnectorCapability;
  createdAt: Date;
}

export interface ClaimContext {
  connectorId: string;
  capabilities: readonly ConnectorCapability[];
  /** Lanes that currently have free capacity on this connector. */
  availableLanes: readonly ConnectorLane[];
}

/** Can this connector claim this job right now? */
export function canClaimJob(job: ClaimableJobView, context: ClaimContext): boolean {
  if (job.targetConnectorId && job.targetConnectorId !== context.connectorId) {
    return false;
  }
  if (!context.capabilities.includes(job.targetCapability)) {
    return false;
  }
  if (!context.availableLanes.includes(job.lane)) {
    return false;
  }
  return true;
}

/**
 * Pick the next job for a connector to run: highest priority first, then oldest.
 * Returns null when nothing is claimable. Audio/spotify jobs naturally win over
 * GPU work because their priority is higher AND their lane stays free while a
 * single long GPU job runs.
 */
export function selectNextJob(
  pending: readonly ClaimableJobView[],
  context: ClaimContext,
): ClaimableJobView | null {
  let best: ClaimableJobView | null = null;
  for (const job of pending) {
    if (!canClaimJob(job, context)) {
      continue;
    }
    if (!best) {
      best = job;
      continue;
    }
    if (job.priority > best.priority) {
      best = job;
      continue;
    }
    if (job.priority === best.priority && job.createdAt < best.createdAt) {
      best = job;
    }
  }
  return best;
}

/** Default time a job may sit pending/running before it is considered expired. */
export const DEFAULT_JOB_TTL_MS: Record<ConnectorLane, number> = {
  audio: 30_000,
  spotify: 30_000,
  gpu: 10 * 60_000,
  printing: 5 * 60_000,
  maintenance: 2 * 60_000,
};

export function defaultExpiryForJobType(type: ConnectorJobType, from: Date = new Date()): Date {
  const lane = CONNECTOR_JOB_DESCRIPTORS[type].lane;
  return new Date(from.getTime() + DEFAULT_JOB_TTL_MS[lane]);
}

export function isJobExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}
