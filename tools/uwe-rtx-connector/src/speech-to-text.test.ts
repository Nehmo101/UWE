import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { audioExtensionForMimeType, runAudioTranscribe } from "./speech-to-text";

/** A tiny STT stand-in: echoes the parsed stdin payload back as the transcript. */
function fakeSttCommand(script: string): string {
  const file = path.join(
    os.tmpdir(),
    `uwe-stt-fake-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
  );
  fs.writeFileSync(file, script, { mode: 0o700 });
  return `node ${file}`;
}

const ECHO = `
import { statSync } from "node:fs";
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const input = JSON.parse(raw);
  const bytes = statSync(input.audioPath).size;
  process.stdout.write(JSON.stringify({
    text: \`\${input.language}:\${bytes}:\${input.audioPath.split(".").pop()}\`,
    model: input.model ?? "fake-default",
  }));
});
`;

describe("audioExtensionForMimeType", () => {
  it("maps the containers a browser can produce", () => {
    assert.equal(audioExtensionForMimeType("audio/webm;codecs=opus"), ".webm");
    assert.equal(audioExtensionForMimeType("audio/ogg"), ".ogg");
    assert.equal(audioExtensionForMimeType("audio/mp4"), ".m4a");
    assert.equal(audioExtensionForMimeType("audio/wav"), ".wav");
  });

  it("treats video/webm as webm — audio/webm shares its EBML header", () => {
    assert.equal(audioExtensionForMimeType("video/webm"), ".webm");
  });

  it("falls back to webm for anything unknown", () => {
    assert.equal(audioExtensionForMimeType("application/octet-stream"), ".webm");
  });
});

describe("runAudioTranscribe", () => {
  it("hands the audio over as a temp file and returns the transcript", async () => {
    const audio = Buffer.from("hello-audio-bytes");
    const result = await runAudioTranscribe(
      { audio: audio.toString("base64"), mimeType: "audio/webm", language: "de" },
      { sttCommand: fakeSttCommand(ECHO), requestTimeoutMs: 10_000 },
    );

    assert.equal(result.text, `de:${audio.length}:webm`);
    assert.equal(result.model, "fake-default");
    assert.equal(result.provider, "local_stt");
  });

  it("forwards the requested model", async () => {
    const result = await runAudioTranscribe(
      {
        audio: Buffer.from("x").toString("base64"),
        mimeType: "audio/webm",
        model: "large-v3-turbo",
      },
      { sttCommand: fakeSttCommand(ECHO), requestTimeoutMs: 10_000 },
    );
    assert.equal(result.model, "large-v3-turbo");
  });

  it("removes the temp recording again", async () => {
    const capture = fakeSttCommand(`
      let raw = "";
      process.stdin.on("data", (chunk) => { raw += chunk; });
      process.stdin.on("end", () => {
        const input = JSON.parse(raw);
        process.stdout.write(JSON.stringify({ text: input.audioPath }));
      });
    `);
    const result = await runAudioTranscribe(
      { audio: Buffer.from("abc").toString("base64"), mimeType: "audio/webm" },
      { sttCommand: capture, requestTimeoutMs: 10_000 },
    );

    assert.equal(fs.existsSync(result.text as string), false, "recording must not linger in tmp");
  });

  it("accepts a plain-text executor that does not emit JSON", async () => {
    const plain = fakeSttCommand(`
      process.stdin.resume();
      process.stdin.on("end", () => process.stdout.write("Hallo Welt"));
    `);
    const result = await runAudioTranscribe(
      { audio: Buffer.from("x").toString("base64"), mimeType: "audio/webm" },
      { sttCommand: plain, requestTimeoutMs: 10_000 },
    );
    assert.equal(result.text, "Hallo Welt");
  });

  it("reports a failing executor and still cleans up", async () => {
    const failing = fakeSttCommand(`
      process.stdin.resume();
      process.stdin.on("end", () => { process.stderr.write("kein Modell"); process.exit(3); });
    `);
    await assert.rejects(
      runAudioTranscribe(
        { audio: Buffer.from("x").toString("base64"), mimeType: "audio/webm" },
        { sttCommand: failing, requestTimeoutMs: 10_000 },
      ),
      /Executor Exit 3.*kein Modell/,
    );
  });

  it("rejects an empty payload", async () => {
    await assert.rejects(
      runAudioTranscribe(
        { audio: "", mimeType: "audio/webm" },
        { sttCommand: "true", requestTimeoutMs: 1_000 },
      ),
      /'audio' \(Base64\) fehlt/,
    );
  });
});
