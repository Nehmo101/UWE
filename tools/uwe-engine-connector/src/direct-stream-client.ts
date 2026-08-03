/**
 * Outbound-only client for the host's direct connector transport.
 *
 * The long-lived response is NDJSON. Requests may be split across arbitrary
 * network chunks, so decoding happens incrementally and only complete lines are
 * parsed. Connector events are posted on a separate authenticated endpoint.
 */

import {
  parseDirectProtocolFrame,
  type DirectConnectorEvent,
  type DirectRequestFrame,
} from "@uwe/connector";
import { DIRECT_MAX_FRAME_BYTES } from "@uwe/connector/direct";

import { HostClientError } from "./host-client";

const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_CAP_MS = 30_000;

export interface DirectStreamClientOptions {
  hostUrl: string;
  token: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  reconnectBaseMs?: number;
  reconnectCapMs?: number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  onError?: (error: unknown) => void;
}

export type DirectRequestHandler = (request: DirectRequestFrame) => void | Promise<void>;

function defaultSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** Decode newline-delimited text without assuming that chunks align to lines. */
export async function* decodeNdjsonLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "").trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield line;
        newline = buffer.indexOf("\n");
      }
      if (buffer.length > DIRECT_MAX_FRAME_BYTES) {
        throw new Error("Direct-Stream enthielt eine zu grosse NDJSON-Zeile.");
      }
    }

    buffer += decoder.decode();
    const finalLine = buffer.replace(/\r$/, "").trim();
    if (finalLine) yield finalLine;
  } finally {
    reader.releaseLock();
  }
}

export class DirectStreamClient {
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly reconnectBaseMs: number;
  private readonly reconnectCapMs: number;
  private readonly sleep: (delayMs: number, signal: AbortSignal) => Promise<void>;
  private abortController: AbortController | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(private readonly options: DirectStreamClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.reconnectBaseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.reconnectCapMs = options.reconnectCapMs ?? DEFAULT_RECONNECT_CAP_MS;
    this.sleep = options.sleep ?? defaultSleep;
  }

  start(onRequest: DirectRequestHandler): void {
    if (this.runPromise) return;
    this.abortController = new AbortController();
    this.runPromise = this.run(onRequest, this.abortController.signal)
      .catch((error) => {
        this.options.onError?.(error);
      })
      .finally(() => {
        this.runPromise = null;
        this.abortController = null;
      });
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    await this.runPromise?.catch(() => undefined);
  }

  async sendEvent(event: DirectConnectorEvent): Promise<void> {
    // Execution starts only after the accepted POST receives an HTTP response.
    // Retry that acknowledgement because the host may have committed it while
    // the response was lost. The host treats duplicate accepted events as OK.
    const attempts = event.kind === "accepted" ? 3 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(
          `${this.options.hostUrl}/api/connectors/direct/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.options.token}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
            signal: AbortSignal.timeout(this.requestTimeoutMs),
          },
        );
        await this.assertSuccessful(response, "Direct-Event");
        return;
      } catch (error) {
        lastError = error;
        if (
          error instanceof HostClientError &&
          (error.status === 401 || error.status === 403)
        ) {
          throw error;
        }
        if (attempt + 1 < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
        }
      }
    }
    if (lastError instanceof HostClientError) throw lastError;
    throw new HostClientError(
      lastError instanceof Error
        ? `Direct-Event nicht zugestellt: ${lastError.message}`
        : "Direct-Event nicht zugestellt",
    );
  }

  private async run(onRequest: DirectRequestHandler, signal: AbortSignal): Promise<void> {
    let reconnectAttempt = 0;
    while (!signal.aborted) {
      try {
        await this.connectOnce(onRequest, signal, () => {
          reconnectAttempt = 0;
        });
      } catch (error) {
        if (signal.aborted) break;
        this.options.onError?.(error);
        if (error instanceof HostClientError && (error.status === 401 || error.status === 403)) {
          break;
        }
      }

      if (signal.aborted) break;
      const delay = Math.min(this.reconnectCapMs, this.reconnectBaseMs * 2 ** reconnectAttempt);
      reconnectAttempt = Math.min(reconnectAttempt + 1, 30);
      await this.waitForReconnect(delay, signal);
    }
  }

  private async connectOnce(
    onRequest: DirectRequestHandler,
    signal: AbortSignal,
    onConnected: () => void,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.hostUrl}/api/connectors/direct/stream`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: "application/x-ndjson",
        },
        signal,
      });
    } catch (error) {
      if (signal.aborted) return;
      throw new HostClientError(
        error instanceof Error
          ? `Direct-Stream nicht erreichbar: ${error.message}`
          : "Direct-Stream nicht erreichbar",
      );
    }

    await this.assertSuccessful(response, "Direct-Stream");
    if (!response.body) {
      throw new HostClientError("Direct-Stream antwortete ohne Body.", response.status);
    }
    onConnected();

    for await (const line of decodeNdjsonLines(response.body)) {
      if (signal.aborted) break;
      const frame = parseDirectProtocolFrame(line);
      if (!frame) {
        this.options.onError?.(new Error("Ungueltiger Direct-Frame."));
        continue;
      }
      // Ping is a keepalive. Cancel is reserved for a future executor API that
      // can propagate AbortSignals; the host currently keeps accepted lanes
      // reserved until their actual terminal event instead of sending cancel.
      // Only requests enter the job scheduler.
      if (frame.kind === "request") {
        await onRequest(frame);
      }
    }
  }

  private async waitForReconnect(delayMs: number, signal: AbortSignal): Promise<void> {
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<void>((resolve) => {
      onAbort = resolve;
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([this.sleep(delayMs, signal), aborted]);
    } finally {
      if (onAbort) {
        signal.removeEventListener("abort", onAbort);
      }
    }
  }

  private async assertSuccessful(response: Response, context: string): Promise<void> {
    if (response.status === 401 || response.status === 403) {
      throw new HostClientError("Host hat das Connector-Token abgelehnt.", response.status);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new HostClientError(
        `${context}: Host antwortet HTTP ${response.status}: ${body.slice(0, 200)}`,
        response.status,
      );
    }
  }
}
