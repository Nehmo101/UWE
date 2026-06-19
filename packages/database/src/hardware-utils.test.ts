import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countOpenSetupSteps, detectHardwareUrlWarnings } from "./hardware-utils";

describe("hardware utils", () => {
  it("warns on public hardware URLs", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "1",
        name: "UWE Host",
        publicUrl: "https://uwe.example.com",
        role: "host",
      },
    ]);

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.field, "publicUrl");
  });

  it("warns when RTX device has public localUrl", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "2",
        name: "RTX Box",
        role: "rtx-agent",
        localUrl: "https://rtx.example.com:8787",
      },
    ]);

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.field, "localUrl");
    assert.match(warnings[0]?.message ?? "", /öffentlich/i);
  });

  it("allows private RTX URLs", () => {
    const warnings = detectHardwareUrlWarnings([
      {
        id: "3",
        name: "RTX Box",
        role: "rtx",
        localUrl: "http://192.168.1.50:8787",
        publicUrl: null,
      },
    ]);

    assert.equal(warnings.length, 0);
  });

  it("counts open setup steps", () => {
    assert.equal(
      countOpenSetupSteps([
        { label: "SSH", done: true },
        { label: "Ollama", done: false },
      ]),
      1,
    );
  });
});
