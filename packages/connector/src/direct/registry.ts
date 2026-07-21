import { type ConnectorCapability } from "../capabilities";
import {
  DIRECT_PROTOCOL_VERSION,
  type DirectConnectorEvent,
  type DirectProtocolFrame,
  type DirectRequestFrame,
} from "../direct-protocol";
import {
  LANE_CONCURRENCY,
  describeConnectorJob,
  type ConnectorJobType,
  type ConnectorLane,
} from "../job-types";
import { DEFAULT_JOB_TTL_MS } from "../queue-logic";

export const DIRECT_MAX_FRAME_BYTES = 16 * 1024 * 1024;
export const DIRECT_KEEPALIVE_INTERVAL_MS = 15_000;
export const DIRECT_MAX_TIMEOUT_MS = 10 * 60_000;

// Re-exported from the single definition in ../direct-protocol so the
// @uwe/connector/direct subpath keeps exposing it (no second declaration).
export type { DirectConnectorEvent };

export interface DirectDispatchInput {
  type: ConnectorJobType;
  payload?: Record<string, unknown>;
  worldId?: string | null;
  targetConnectorId?: string | null;
  timeoutMs?: number;
  idempotencyKey?: string;
}

export interface DirectDispatchResult {
  requestId: string;
  result: unknown;
  connectorId: string;
}

export interface DirectSessionInput {
  connectorId: string;
  capabilities: readonly ConnectorCapability[];
  signal?: AbortSignal;
}

export interface DirectSessionHandle {
  stream: ReadableStream<Uint8Array>;
  close: () => void;
}

export interface DirectSessionSummary {
  connectorId: string;
  capabilities: ConnectorCapability[];
  laneUsage: Readonly<Record<ConnectorLane, number>>;
}

export interface DirectEventResult {
  ok: boolean;
  reason?: "unknown_request" | "wrong_connector" | "duplicate_event" | "out_of_order";
}

interface SessionState {
  connectorId: string;
  capabilities: Set<ConnectorCapability>;
  controller: ReadableStreamDefaultController<Uint8Array> | null;
  laneUsage: Record<ConnectorLane, number>;
  keepalive: ReturnType<typeof setInterval> | null;
  closed: boolean;
}

interface PendingRequest {
  requestId: string;
  connectorId: string;
  lane: ConnectorLane;
  accepted: boolean;
  lastProgress: string | null;
  resolve: (value: DirectDispatchResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const EMPTY_LANE_USAGE = (): Record<ConnectorLane, number> => ({
  audio: 0,
  spotify: 0,
  gpu: 0,
  printing: 0,
  maintenance: 0,
});

const encoder = new TextEncoder();

export class DirectConnectorDispatchError extends Error {
  constructor(
    message: string,
    public readonly accepted: boolean,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "DirectConnectorDispatchError";
  }
}

export class DirectConnectorUnavailableError extends DirectConnectorDispatchError {
  constructor(
    message = "No matching Direct Connector is connected.",
    accepted = false,
    requestId?: string,
  ) {
    super(message, accepted, requestId);
    this.name = "DirectConnectorUnavailableError";
  }
}

export class DirectConnectorTimeoutError extends DirectConnectorDispatchError {
  constructor(requestId: string, accepted: boolean) {
    super(`Direct Connector request ${requestId} exceeded its timeout.`, accepted, requestId);
    this.name = "DirectConnectorTimeoutError";
  }
}

export class DirectConnectorExecutionError extends DirectConnectorDispatchError {
  constructor(
    requestId: string,
    message: string,
    public readonly code?: string,
    public readonly retryable?: boolean,
    accepted = true,
  ) {
    super(message, accepted, requestId);
    this.name = "DirectConnectorExecutionError";
  }
}

export function wasDirectRequestAccepted(error: unknown): boolean {
  return error instanceof DirectConnectorDispatchError && error.accepted;
}

export class DirectConnectorRegistry {
  private readonly sessions = new Map<string, SessionState>();
  private readonly pending = new Map<string, PendingRequest>();

  hasCapability(capability: ConnectorCapability): boolean {
    return [...this.sessions.values()].some(
      (session) => !session.closed && session.capabilities.has(capability),
    );
  }

  isConnected(connectorId: string): boolean {
    const session = this.sessions.get(connectorId);
    return Boolean(session && !session.closed);
  }

  listSessions(): DirectSessionSummary[] {
    return [...this.sessions.values()]
      .filter((session) => !session.closed)
      .map((session) => ({
        connectorId: session.connectorId,
        capabilities: [...session.capabilities],
        laneUsage: { ...session.laneUsage },
      }));
  }
  updateCapabilities(connectorId: string, capabilities: readonly ConnectorCapability[]): boolean {
    const session = this.sessions.get(connectorId);
    if (!session || session.closed) return false;
    session.capabilities = new Set(capabilities);
    return true;
  }


  openSession(input: DirectSessionInput): DirectSessionHandle {
    this.disconnect(input.connectorId, "Direct session was replaced.");

    const session: SessionState = {
      connectorId: input.connectorId,
      capabilities: new Set(input.capabilities),
      controller: null,
      laneUsage: EMPTY_LANE_USAGE(),
      keepalive: null,
      closed: false,
    };

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        session.controller = controller;
        this.sessions.set(input.connectorId, session);
        this.writeFrame(session, {
          version: DIRECT_PROTOCOL_VERSION,
          kind: "ping",
          timestamp: new Date().toISOString(),
        });
        session.keepalive = setInterval(() => {
          if (!session.closed) {
            this.writeFrame(session, {
              version: DIRECT_PROTOCOL_VERSION,
              kind: "ping",
              timestamp: new Date().toISOString(),
            });
          }
        }, DIRECT_KEEPALIVE_INTERVAL_MS);
      },
      cancel: () => this.disconnectIfCurrent(session, "Direct session disconnected."),
    });

    const close = () => this.disconnectIfCurrent(session, "Direct session disconnected.");
    input.signal?.addEventListener("abort", close, { once: true });
    return { stream, close };
  }

  async dispatch(input: DirectDispatchInput): Promise<DirectDispatchResult> {
    const descriptor = describeConnectorJob(input.type);
    const session = this.selectSession(
      descriptor.capability,
      descriptor.lane,
      input.targetConnectorId ?? null,
    );
    if (!session) {
      throw new DirectConnectorUnavailableError();
    }

    const payload = input.payload ?? {};
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new DirectConnectorDispatchError("Direct Connector payload must be an object.", false);
    }
    this.assertPayloadSize(payload);
    if (input.worldId && input.worldId.length > 200) {
      throw new TypeError("worldId is too long.");
    }
    if (input.idempotencyKey && input.idempotencyKey.length > 200) {
      throw new TypeError("idempotencyKey is too long.");
    }

    const requestedTimeout = input.timeoutMs ?? DEFAULT_JOB_TTL_MS[descriptor.lane];
    const timeoutMs = Math.max(250, Math.min(requestedTimeout, DIRECT_MAX_TIMEOUT_MS));
    const requestId = crypto.randomUUID();
    if (!Number.isFinite(requestedTimeout) || requestedTimeout <= 0) {
      throw new TypeError("timeoutMs must be a positive finite number.");
    }
    const frame: DirectRequestFrame = {
      version: DIRECT_PROTOCOL_VERSION,
      kind: "request",
      requestId,
      type: input.type,
      lane: descriptor.lane,
      priority: descriptor.priority,
      payload,
      ...(input.worldId ? { worldId: input.worldId } : {}),
      expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    };

    session.laneUsage[descriptor.lane] += 1;
    return new Promise<DirectDispatchResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(requestId);
        if (!pending) return;
        const accepted = pending.accepted;
        // Before acceptance, removing the request makes a later accepted retry
        // fail and therefore keeps queue fallback safe. After acceptance the
        // local executor may still be running; retain its lane reservation until
        // a terminal event or disconnect instead of pretending it was cancelled.
        if (!accepted) this.finishPending(pending);
        reject(new DirectConnectorTimeoutError(requestId, accepted));
      }, timeoutMs);

      this.pending.set(requestId, {
        requestId,
        connectorId: session.connectorId,
        lane: descriptor.lane,
        accepted: false,
        lastProgress: null,
        resolve,
        reject,
        timeout,
      });

      if (!this.writeFrame(session, frame)) {
        const pending = this.pending.get(requestId);
        if (pending) this.finishPending(pending);
        reject(
          new DirectConnectorUnavailableError(
            "Direct session is no longer connected.",
            false,
            requestId,
          ),
        );
      }
    });
  }

  handleEvent(connectorId: string, event: DirectConnectorEvent): DirectEventResult {
    const pending = this.pending.get(event.requestId);
    if (!pending) return { ok: false, reason: "unknown_request" };
    if (pending.connectorId !== connectorId) return { ok: false, reason: "wrong_connector" };

    if (event.kind === "accepted") {
      // Accepted acknowledgements are intentionally idempotent. The connector
      // retries this event when the host handled the POST but the HTTP response
      // was lost; replying successfully prevents the work from being dropped.
      if (pending.accepted) return { ok: true };
      pending.accepted = true;
      return { ok: true };
    }

    if (event.kind === "error") {
      const accepted = pending.accepted;
      this.finishPending(pending);
      pending.reject(
        new DirectConnectorExecutionError(
          pending.requestId,
          event.message,
          event.code,
          event.retryable,
          accepted,
        ),
      );
      return { ok: true };
    }

    if (!pending.accepted) return { ok: false, reason: "out_of_order" };

    if (event.kind === "progress") {
      const signature = `${event.progress}:${event.message ?? ""}`;
      if (pending.lastProgress === signature) {
        return { ok: false, reason: "duplicate_event" };
      }
      pending.lastProgress = signature;
      return { ok: true };
    }

    this.finishPending(pending);
    pending.resolve({
      requestId: pending.requestId,
      result: event.result,
      connectorId: pending.connectorId,
    });
    return { ok: true };
  }

  disconnect(connectorId: string, reason = "Direct session disconnected."): void {
    const session = this.sessions.get(connectorId);
    if (!session || session.closed) return;
    session.closed = true;
    this.sessions.delete(connectorId);
    if (session.keepalive) clearInterval(session.keepalive);
    try {
      session.controller?.close();
    } catch {
      // Stream cancellation may already have closed the controller.
    }
    for (const pending of [...this.pending.values()]) {
      if (pending.connectorId !== connectorId) continue;
      const accepted = pending.accepted;
      this.finishPending(pending);
      pending.reject(new DirectConnectorUnavailableError(reason, accepted, pending.requestId));
    }
  }
  private disconnectIfCurrent(session: SessionState, reason: string): void {
    if (this.sessions.get(session.connectorId) === session) {
      this.disconnect(session.connectorId, reason);
    }
  }


  private selectSession(
    capability: ConnectorCapability,
    lane: ConnectorLane,
    targetConnectorId: string | null,
  ): SessionState | null {
    const candidates = targetConnectorId
      ? [this.sessions.get(targetConnectorId)].filter((value): value is SessionState => Boolean(value))
      : [...this.sessions.values()];
    return (
      candidates.find(
        (session) =>
          !session.closed &&
          session.capabilities.has(capability) &&
          session.laneUsage[lane] < LANE_CONCURRENCY[lane],
      ) ?? null
    );
  }

  private writeFrame(session: SessionState, frame: DirectProtocolFrame): boolean {
    if (session.closed || !session.controller) return false;
    try {
      session.controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      return true;
    } catch {
      this.disconnectIfCurrent(session, "Direct session could not be written.");
      return false;
    }
  }

  private assertPayloadSize(payload: Record<string, unknown>): void {
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      throw new DirectConnectorDispatchError("Direct Connector payload is not serializable.", false);
    }
    if (encoder.encode(serialized).byteLength > DIRECT_MAX_FRAME_BYTES) {
      throw new DirectConnectorDispatchError("Direct Connector payload exceeds the size limit.", false);
    }
  }

  private finishPending(pending: PendingRequest): void {
    if (!this.pending.delete(pending.requestId)) return;
    clearTimeout(pending.timeout);
    const session = this.sessions.get(pending.connectorId);
    if (session) {
      session.laneUsage[pending.lane] = Math.max(0, session.laneUsage[pending.lane] - 1);
    }
  }
}

type DirectRegistryGlobal = typeof globalThis & {
  __uweDirectConnectorRegistry?: DirectConnectorRegistry;
};

export function getDirectConnectorRegistry(): DirectConnectorRegistry {
  const target = globalThis as DirectRegistryGlobal;
  target.__uweDirectConnectorRegistry ??= new DirectConnectorRegistry();
  return target.__uweDirectConnectorRegistry;
}
