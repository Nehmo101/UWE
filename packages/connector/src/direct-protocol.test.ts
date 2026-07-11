import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DIRECT_PROTOCOL_VERSION,
  isDirectProtocolFrame,
  parseDirectProtocolFrame,
  type DirectRequestFrame,
} from "./direct-protocol";

const request: DirectRequestFrame = {
  version: DIRECT_PROTOCOL_VERSION,
  kind: "request",
  requestId: "req-1",
  type: "llm_generate",
  lane: "gpu",
  priority: 50,
  payload: { prompt: "Hello" },
  worldId: "world-1",
  expiresAt: "2026-07-11T12:00:00.000Z",
  idempotencyKey: "idem-1",
};

test("accepts every direct protocol v1 frame kind", () => {
  const frames = [
    request,
    { version: 1, kind: "accepted", requestId: "req-1", acceptedAt: "now" },
    { version: 1, kind: "progress", requestId: "req-1", progress: 0.5, message: "half" },
    { version: 1, kind: "result", requestId: "req-1", result: { text: "done" } },
    {
      version: 1,
      kind: "error",
      requestId: "req-1",
      message: "failed",
      code: "EXEC_FAILED",
      retryable: false,
    },
    { version: 1, kind: "cancel", requestId: "req-1", reason: "deadline" },
    { version: 1, kind: "ping", timestamp: "2026-07-11T12:00:00.000Z" },
  ];

  for (const frame of frames) {
    assert.equal(isDirectProtocolFrame(frame), true);
  }
});

test("parses JSON lines and preserves typed payloads", () => {
  assert.deepEqual(parseDirectProtocolFrame(JSON.stringify(request)), request);
  assert.deepEqual(parseDirectProtocolFrame(request), request);
});

test("rejects unsupported versions and invalid required fields", () => {
  assert.equal(isDirectProtocolFrame({ ...request, version: 2 }), false);
  assert.equal(isDirectProtocolFrame({ ...request, requestId: "" }), false);
  assert.equal(isDirectProtocolFrame({ ...request, lane: "network" }), false);
  assert.equal(isDirectProtocolFrame({ ...request, payload: undefined }), false);
  assert.equal(
    isDirectProtocolFrame({ version: 1, kind: "progress", requestId: "req-1", progress: 1.1 }),
    false,
  );
  assert.equal(
    isDirectProtocolFrame({ version: 1, kind: "result", requestId: "req-1" }),
    false,
  );
});

test("returns null for malformed JSON and unknown frame kinds", () => {
  assert.equal(parseDirectProtocolFrame("{"), null);
  assert.equal(parseDirectProtocolFrame({ version: 1, kind: "hello" }), null);
  assert.equal(parseDirectProtocolFrame(null), null);
});
