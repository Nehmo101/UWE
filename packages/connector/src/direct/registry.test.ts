import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseDirectProtocolFrame, type DirectRequestFrame } from "../direct-protocol";
import {
  DIRECT_MAX_FRAME_BYTES,
  DirectConnectorDispatchError,
  DirectConnectorRegistry,
  wasDirectRequestAccepted,
} from "./registry";

const decoder = new TextDecoder();

async function readRequest(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<DirectRequestFrame> {
  while (true) {
    const read = await reader.read();
    assert.equal(read.done, false);
    const frame = parseDirectProtocolFrame(decoder.decode(read.value).trim());
    assert.ok(frame);
    if (frame.kind === "request") return frame;
  }
}

describe("DirectConnectorRegistry", () => {
  it("dispatches directly and resolves a correlated result", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });
    const reader = session.stream.getReader();

    assert.equal(registry.hasCapability("llm_local"), true);
    assert.equal(registry.isConnected("connector-a"), true);
    assert.deepEqual(registry.listSessions()[0]?.capabilities, ["llm_local"]);

    const completion = registry.dispatch({
      type: "llm_generate",
      payload: { prompt: "hello" },
      idempotencyKey: "same-request",
    });
    const request = await readRequest(reader);
    assert.equal(request.payload && (request.payload as { prompt?: string }).prompt, "hello");
    assert.equal(request.idempotencyKey, "same-request");

    assert.deepEqual(
      registry.handleEvent("connector-a", {
        version: 1,
        kind: "accepted",
        requestId: request.requestId,
      }),
      { ok: true },
    );
    assert.deepEqual(
      registry.handleEvent("connector-a", {
        version: 1,
        kind: "accepted",
        requestId: request.requestId,
      }),
      { ok: true },
    );
    assert.deepEqual(
      registry.handleEvent("connector-a", {
        version: 1,
        kind: "result",
        requestId: request.requestId,
        result: { text: "done" },
      }),
      { ok: true },
    );

    assert.deepEqual(await completion, {
      requestId: request.requestId,
      connectorId: "connector-a",
      result: { text: "done" },
    });
    assert.equal(registry.listSessions()[0]?.laneUsage.gpu, 0);
    session.close();
  });

  it("marks a connector rejection before accepted as fallback-safe", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });
    const reader = session.stream.getReader();
    const completion = registry.dispatch({ type: "llm_generate" });
    const request = await readRequest(reader);

    registry.handleEvent("connector-a", {
      version: 1,
      kind: "error",
      requestId: request.requestId,
      message: "lane busy",
      code: "lane_busy",
      retryable: true,
    });

    await assert.rejects(completion, (error: unknown) => {
      assert.ok(error instanceof DirectConnectorDispatchError);
      assert.equal(error.accepted, false);
      assert.equal(wasDirectRequestAccepted(error), false);
      return true;
    });
    session.close();
  });

  it("marks disconnects after accepted as unsafe for queue fallback", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });
    const reader = session.stream.getReader();
    const completion = registry.dispatch({ type: "llm_generate" });
    const request = await readRequest(reader);
    registry.handleEvent("connector-a", {
      version: 1,
      kind: "accepted",
      requestId: request.requestId,
    });

    registry.disconnect("connector-a", "connection lost");

    await assert.rejects(completion, (error: unknown) => {
      assert.equal(wasDirectRequestAccepted(error), true);
      return true;
    });
    assert.equal(registry.isConnected("connector-a"), false);
  });

  it("enforces lane concurrency without creating a queue", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local", "embedding_local"],
    });
    const reader = session.stream.getReader();
    const first = registry.dispatch({ type: "llm_generate" });
    const request = await readRequest(reader);

    await assert.rejects(
      registry.dispatch({ type: "embedding_generate" }),
      (error: unknown) => {
        assert.equal(wasDirectRequestAccepted(error), false);
        return true;
      },
    );

    registry.handleEvent("connector-a", {
      version: 1,
      kind: "accepted",
      requestId: request.requestId,
    });
    registry.handleEvent("connector-a", {
      version: 1,
      kind: "result",
      requestId: request.requestId,
      result: null,
    });
    await first;
    session.close();
  });

  it("rejects oversized payloads before sending a request", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });

    await assert.rejects(
      registry.dispatch({
        type: "llm_generate",
        payload: { text: "x".repeat(DIRECT_MAX_FRAME_BYTES + 1) },
      }),
      (error: unknown) => {
        assert.ok(error instanceof DirectConnectorDispatchError);
        assert.equal(error.accepted, false);
        assert.match(error.message, /size limit/);
        return true;
      },
    );
    assert.equal(registry.listSessions()[0]?.laneUsage.gpu, 0);
    session.close();
  });

  it("marks unserializable payloads as fallback-safe before sending a request", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });
    const payload: Record<string, unknown> = {};
    payload.circular = payload;

    await assert.rejects(
      registry.dispatch({ type: "llm_generate", payload }),
      (error: unknown) => {
        assert.ok(error instanceof DirectConnectorDispatchError);
        assert.equal(error.accepted, false);
        assert.match(error.message, /not serializable/);
        return true;
      },
    );
    assert.equal(registry.listSessions()[0]?.laneUsage.gpu, 0);
    session.close();
  });

  it("retains accepted lane usage until the executor sends a terminal event", async () => {
    const registry = new DirectConnectorRegistry();
    const session = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });
    const reader = session.stream.getReader();
    const completion = registry.dispatch({ type: "llm_generate", timeoutMs: 250 });
    const request = await readRequest(reader);
    registry.handleEvent("connector-a", {
      version: 1,
      kind: "accepted",
      requestId: request.requestId,
    });

    await assert.rejects(completion, (error: unknown) => {
      assert.equal(wasDirectRequestAccepted(error), true);
      return true;
    });
    assert.equal(registry.listSessions()[0]?.laneUsage.gpu, 1);

    registry.handleEvent("connector-a", {
      version: 1,
      kind: "result",
      requestId: request.requestId,
      result: { text: "late but complete" },
    });
    assert.equal(registry.listSessions()[0]?.laneUsage.gpu, 0);
    session.close();
  });
  it("does not let an old aborted stream close its replacement session", () => {
    const registry = new DirectConnectorRegistry();
    const oldAbort = new AbortController();
    registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
      signal: oldAbort.signal,
    });
    const replacement = registry.openSession({
      connectorId: "connector-a",
      capabilities: ["llm_local"],
    });

    oldAbort.abort();

    assert.equal(registry.isConnected("connector-a"), true);
    replacement.close();
  });
});
