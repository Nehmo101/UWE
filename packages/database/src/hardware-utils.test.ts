import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHardwareUrlWarnings } from "./hardware-utils";

describe("hardware URL policy warnings", () => {
  it("warns when public URL is set on hardware device", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "dev-1",
        name: "Ollama Server",
        publicUrl: "https://ollama.example.com",
        role: "local-ai",
      },
    ]);

    assert.ok(warnings.length >= 1);
    assert.ok(warnings.some((w) => w.field === "publicUrl"));
    assert.match(warnings[0]!.message, /öffentlich/i);
  });

  it("warns when RTX device has non-local public URL", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "rtx-1",
        name: "RTX Agent",
        publicUrl: "https://rtx.example.com",
        role: "rtx-inference",
      },
    ]);

    assert.ok(warnings.length >= 1);
    assert.ok(warnings.some((w) => w.message.includes("RTX")));
  });

  it("allows loopback and private URLs without warnings", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "local-1",
        name: "Local Ollama",
        publicUrl: "http://127.0.0.1:11434",
        localUrl: "http://192.168.1.50:11434",
        role: "rtx-inference",
      },
    ]);

    assert.equal(warnings.length, 0);
  });

  it("ignores devices without public URL", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "nas-1",
        name: "NAS",
        localUrl: "http://192.168.1.10",
        role: "storage",
      },
    ]);

    assert.equal(warnings.length, 0);
  });
});
