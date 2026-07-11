import {
  isConnectorJobType,
  type ConnectorJobType,
  type ConnectorLane,
} from "./job-types";

export const DIRECT_PROTOCOL_VERSION = 1 as const;

interface DirectFrameBase {
  version: typeof DIRECT_PROTOCOL_VERSION;
  kind: string;
}

export interface DirectRequestFrame extends DirectFrameBase {
  kind: "request";
  requestId: string;
  type: ConnectorJobType;
  lane: ConnectorLane;
  priority: number;
  payload: unknown;
  worldId?: string;
  expiresAt?: string;
  idempotencyKey?: string;
}

export interface DirectAcceptedFrame extends DirectFrameBase {
  kind: "accepted";
  requestId: string;
  acceptedAt?: string;
}

export interface DirectProgressFrame extends DirectFrameBase {
  kind: "progress";
  requestId: string;
  /** Normalized progress from 0 through 1. */
  progress: number;
  message?: string;
}

export interface DirectResultFrame extends DirectFrameBase {
  kind: "result";
  requestId: string;
  result: unknown;
}

export interface DirectErrorFrame extends DirectFrameBase {
  kind: "error";
  requestId: string;
  message: string;
  code?: string;
  retryable?: boolean;
}

export interface DirectCancelFrame extends DirectFrameBase {
  kind: "cancel";
  requestId: string;
  reason?: string;
}

export interface DirectPingFrame extends DirectFrameBase {
  kind: "ping";
  timestamp: string;
}

export type DirectProtocolFrame =
  | DirectRequestFrame
  | DirectAcceptedFrame
  | DirectProgressFrame
  | DirectResultFrame
  | DirectErrorFrame
  | DirectCancelFrame
  | DirectPingFrame;

export type DirectConnectorEvent =
  | DirectAcceptedFrame
  | DirectProgressFrame
  | DirectResultFrame
  | DirectErrorFrame;

export type DirectHostFrame = DirectRequestFrame | DirectCancelFrame | DirectPingFrame;

const CONNECTOR_LANE_SET = new Set<ConnectorLane>([
  "audio",
  "spotify",
  "gpu",
  "printing",
  "maintenance",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

function hasRequestId(frame: Record<string, unknown>): boolean {
  return isNonEmptyString(frame.requestId);
}

function isRequestFrame(frame: Record<string, unknown>): boolean {
  return (
    hasRequestId(frame) &&
    isConnectorJobType(frame.type) &&
    typeof frame.lane === "string" &&
    CONNECTOR_LANE_SET.has(frame.lane as ConnectorLane) &&
    typeof frame.priority === "number" &&
    Number.isFinite(frame.priority) &&
    hasOwn(frame, "payload") &&
    frame.payload !== undefined &&
    isOptionalString(frame.worldId) &&
    isOptionalString(frame.expiresAt) &&
    isOptionalString(frame.idempotencyKey)
  );
}

function isProgressFrame(frame: Record<string, unknown>): boolean {
  return (
    hasRequestId(frame) &&
    typeof frame.progress === "number" &&
    Number.isFinite(frame.progress) &&
    frame.progress >= 0 &&
    frame.progress <= 1 &&
    isOptionalString(frame.message)
  );
}

export function isDirectProtocolFrame(value: unknown): value is DirectProtocolFrame {
  if (!isRecord(value) || value.version !== DIRECT_PROTOCOL_VERSION) {
    return false;
  }

  switch (value.kind) {
    case "request":
      return isRequestFrame(value);
    case "accepted":
      return hasRequestId(value) && isOptionalString(value.acceptedAt);
    case "progress":
      return isProgressFrame(value);
    case "result":
      return hasRequestId(value) && hasOwn(value, "result");
    case "error":
      return (
        hasRequestId(value) &&
        isNonEmptyString(value.message) &&
        isOptionalString(value.code) &&
        (value.retryable === undefined || typeof value.retryable === "boolean")
      );
    case "cancel":
      return hasRequestId(value) && isOptionalString(value.reason);
    case "ping":
      return isNonEmptyString(value.timestamp);
    default:
      return false;
  }
}

/**
 * Parse an object or JSON/NDJSON line into a validated v1 protocol frame.
 * Returns null for malformed JSON, unsupported versions, or invalid fields.
 */
export function parseDirectProtocolFrame(input: unknown): DirectProtocolFrame | null {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }
  return isDirectProtocolFrame(value) ? value : null;
}
