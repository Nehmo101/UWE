import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signWebhookPayload, verifyWebhookSignature } from "./webhook-signature-server";

describe("webhook-signature", () => {
  it("signs and verifies payloads", () => {
    const secret = "whsec_test";
    const timestamp = String(Date.now());
    const body = JSON.stringify({ event: "webhook.test" });
    const signature = signWebhookPayload(secret, timestamp, body);
    assert.ok(verifyWebhookSignature(secret, timestamp, body, signature));
  });

  it("rejects tampered signatures", () => {
    const secret = "whsec_test";
    const timestamp = String(Date.now());
    const body = "{}";
    assert.equal(verifyWebhookSignature(secret, timestamp, body, "deadbeef"), false);
  });

  it("rejects expired timestamps", () => {
    const secret = "whsec_test";
    const timestamp = String(Date.now() - 600_000);
    const body = "{}";
    const signature = signWebhookPayload(secret, timestamp, body);
    assert.equal(verifyWebhookSignature(secret, timestamp, body, signature, 60), false);
  });
});
