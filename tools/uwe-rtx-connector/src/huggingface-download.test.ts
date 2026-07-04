import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { downloadHuggingFaceModel } from "./huggingface-download";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "uwe-hf-download-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.UWE_HF_DOWNLOAD_IDLE_TIMEOUT_MS;
});

/** Build a mock fetch whose body streams the given chunks and closes. */
function streamingFetch(
  chunks: Uint8Array[],
  init: { headers?: Record<string, string>; captureSignal?: (signal: AbortSignal | null) => void } = {},
): typeof fetch {
  return (async (_url: string | URL | Request, requestInit?: RequestInit) => {
    init.captureSignal?.(requestInit?.signal ?? null);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    return new Response(stream, { headers: init.headers });
  }) as unknown as typeof fetch;
}

const targetFor = (fileName: string) =>
  join(dir, "models", "huggingface", "acme", "model", "main", fileName);
const partFor = (fileName: string) => `${targetFor(fileName)}.part`;

describe("downloadHuggingFaceModel", () => {
  it("writes the streamed file, cleans up the .part temp and records a profile", async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    let seenSignal: AbortSignal | null | undefined;
    const result = await downloadHuggingFaceModel(
      dir,
      { repoId: "acme/model", filename: "weights.gguf" },
      undefined,
      streamingFetch([payload], {
        headers: { "content-length": String(payload.byteLength) },
        captureSignal: (signal) => {
          seenSignal = signal;
        },
      }),
    );

    assert.equal(result.sizeBytes, payload.byteLength);
    assert.equal(result.path, targetFor("weights.gguf"));
    assert.ok(existsSync(targetFor("weights.gguf")), "final file should exist");
    assert.ok(!existsSync(partFor("weights.gguf")), ".part temp should be removed");
    assert.equal(result.profile.provider, "huggingface");
    assert.equal(result.store.profiles.some((p) => p.id === result.profile.id), true);
    // The download fetch must be abortable (idle-timeout wiring).
    assert.ok(seenSignal instanceof AbortSignal, "fetch should receive an AbortSignal");
  });

  it("aborts and cleans up when the connection stalls past the idle timeout", async () => {
    process.env.UWE_HF_DOWNLOAD_IDLE_TIMEOUT_MS = "40";

    // A body that emits one chunk then never closes; it errors only when the
    // request signal aborts — mirroring how real fetch wires the AbortSignal.
    const stallingFetch = (async (_url: string | URL | Request, requestInit?: RequestInit) => {
      const signal = requestInit?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          signal?.addEventListener("abort", () => {
            controller.error(signal.reason ?? new Error("aborted"));
          });
        },
      });
      return new Response(stream, { headers: {} });
    }) as unknown as typeof fetch;

    await assert.rejects(
      downloadHuggingFaceModel(dir, { repoId: "acme/model", filename: "weights.gguf" }, undefined, stallingFetch),
      /keine Daten empfangen/,
    );

    assert.ok(!existsSync(partFor("weights.gguf")), ".part temp should be cleaned up after an idle abort");
    assert.ok(!existsSync(targetFor("weights.gguf")), "no final file on aborted download");
  });

  it("cleans up the .part temp when the response stream errors mid-download", async () => {
    const erroringFetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.error(new Error("stream boom"));
        },
      });
      return new Response(stream, { headers: {} });
    }) as unknown as typeof fetch;

    await assert.rejects(
      downloadHuggingFaceModel(dir, { repoId: "acme/model", filename: "weights.gguf" }, undefined, erroringFetch),
      /stream boom/,
    );

    assert.ok(!existsSync(partFor("weights.gguf")), ".part temp should be cleaned up after a stream error");
    assert.ok(!existsSync(targetFor("weights.gguf")), "no final file on failed download");
  });
});
