import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "x-uwe-signature";
export const WEBHOOK_TIMESTAMP_HEADER = "x-uwe-timestamp";

export function signWebhookPayload(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const payload = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
  maxAgeSeconds = 300,
): boolean {
  if (!signature?.trim() || !timestamp?.trim()) {
    return false;
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() - timestampMs) / 1000;
  if (ageSeconds > maxAgeSeconds) {
    return false;
  }

  const expected = signWebhookPayload(secret, timestamp, body);
  const provided = Buffer.from(signature.trim());
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(provided, expectedBuf);
}

export function generateWebhookSecret(): string {
  return `whsec_${createHmac("sha256", "uwe-webhook-init").update(`${Date.now()}`).digest("hex").slice(0, 48)}`;
}
