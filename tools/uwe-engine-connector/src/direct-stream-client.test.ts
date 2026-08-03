import assert from "node:assert/strict";
import { test } from "node:test";

import { DIRECT_PROTOCOL_VERSION, type DirectRequestFrame } from "@uwe/connector";
import { DIRECT_MAX_FRAME_BYTES } from "@uwe/connector/direct";

import { decodeNdjsonLines, DirectStreamClient } from "./direct-stream-client";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition not met");
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

test("decodeNdjsonLines handles split chunks, CRLF, blanks and a final line", async () => {
  const lines: string[] = [];
  for await (const line of decodeNdjsonLines(streamFrom(["{\"a\":", "1}\r\n\n{\"b\":2}"]))) {
    lines.push(line);
  }
  assert.deepEqual(lines, ['{"a":1}', '{"b":2}']);
});

test("decodeNdjsonLines accepts frames above the legacy one MiB limit", async () => {
  const serialized = JSON.stringify({ data: "x".repeat(1024 * 1024 + 64) });
  assert.ok(serialized.length < DIRECT_MAX_FRAME_BYTES);
  const lines: string[] = [];
  for await (const line of decodeNdjsonLines(streamFrom([serialized]))) {
    lines.push(line);
  }
  assert.equal(lines[0]?.length, serialized.length);
});

test("direct client reconnects and dispatches a request split across chunks", async () => {
  const request: DirectRequestFrame = {
    version: DIRECT_PROTOCOL_VERSION,
    kind: "request",
    requestId: "req-1",
    type: "sound_play",
    lane: "audio",
    priority: 50,
    payload: { sourceUrl: "local.wav" },
  };
  const serialized = JSON.stringify(request);
  const requests: DirectRequestFrame[] = [];
  const delays: number[] = [];
  let getCalls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer uwec_secret");
    getCalls += 1;
    if (getCalls === 1) {
      return new Response("temporarily unavailable", { status: 503 });
    }
    if (getCalls === 2) {
      return new Response(streamFrom([]), { status: 200 });
    }
    return new Response(streamFrom([serialized.slice(0, 18), serialized.slice(18) + "\n"]), {
      status: 200,
    });
  };

  const client = new DirectStreamClient({
    hostUrl: "https://host.test",
    token: "uwec_secret",
    fetchImpl,
    reconnectBaseMs: 5,
    reconnectCapMs: 20,
    sleep: async (delay) => {
      delays.push(delay);
    },
  });
  client.start((frame) => {
    requests.push(frame);
    void client.stop();
  });

  await waitUntil(() => requests.length === 1);
  await client.stop();

  assert.equal(getCalls, 3);
  assert.deepEqual(delays, [5, 5]);
  assert.equal(requests[0].requestId, "req-1");
});

test("stop aborts a pending reconnect backoff immediately", async () => {
  let errors = 0;
  const client = new DirectStreamClient({
    hostUrl: "https://host.test",
    token: "uwec_secret",
    fetchImpl: async () => new Response("temporarily unavailable", { status: 503 }),
    reconnectBaseMs: 30_000,
    reconnectCapMs: 30_000,
    onError: () => {
      errors += 1;
    },
  });
  client.start(() => undefined);
  await waitUntil(() => errors === 1);
  const stopped = client.stop().then(() => true);
  assert.equal(await Promise.race([stopped, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200))]), true);
});

test("sendEvent retries an ambiguous accepted acknowledgement", async () => {
  let calls = 0;
  const client = new DirectStreamClient({
    hostUrl: "https://host.test",
    token: "uwec_secret",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error("response lost");
      return new Response(null, { status: 204 });
    },
  });

  await client.sendEvent({
    version: DIRECT_PROTOCOL_VERSION,
    kind: "accepted",
    requestId: "req-retry",
  });

  assert.equal(calls, 2);
});
test("sendEvent posts authenticated protocol JSON without logging credentials", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const client = new DirectStreamClient({
    hostUrl: "https://host.test",
    token: "uwec_secret",
    fetchImpl: async (input, init) => {
      captured = { url: String(input), init };
      return new Response(null, { status: 204 });
    },
  });

  await client.sendEvent({
    version: DIRECT_PROTOCOL_VERSION,
    kind: "accepted",
    requestId: "req-2",
  });

  assert.equal(captured?.url, "https://host.test/api/connectors/direct/events");
  assert.equal(new Headers(captured?.init?.headers).get("Authorization"), "Bearer uwec_secret");
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), {
    version: 1,
    kind: "accepted",
    requestId: "req-2",
  });
});
