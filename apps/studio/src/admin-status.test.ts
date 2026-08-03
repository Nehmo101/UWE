import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("admin dashboard status shape", () => {
  it("includes inference block without secrets", () => {
    const payload = {
      ok: false,
      timestamp: new Date().toISOString(),
      inference: {
        enabled: true,
        configured: true,
        provider: "ollama",
        providerId: "ollama",
        endpoint: "http://192.168.1.50:11434",
        defaultModel: "llama3.2",
        timeoutSeconds: 120,
        allowPublicUrl: false,
        urlAllowed: true,
        urlKind: "private",
        online: false,
        message: "Maschinenraum-Inference nicht erreichbar",
        offlineReason: "fetch failed",
      },
      mail: {
        smtpPasswordConfigured: true,
        smtpUserConfigured: true,
      },
    };

    assert.equal(payload.inference.online, false);
    assert.ok(payload.inference.offlineReason);
    assert.ok(!JSON.stringify(payload).includes("SMTP_PASSWORD"));
  });
});
