import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "metadata.google.internal", "metadata"]);

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    return true;
  }
  if (lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".lan")) {
    return true;
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const parts = hostname.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  if (ipVersion === 6) {
    const normalized = lower.replace(/^\[|\]$/g, "");
    if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      return true;
    }
  }
  return false;
}

export function assertWebhookUrlAllowed(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Ungültige Webhook-URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook-URL muss http oder https verwenden.");
  }

  const hostname = parsed.hostname;
  if (!hostname || isPrivateHostname(hostname)) {
    throw new Error("Webhook-URL darf nicht auf private oder interne Adressen zeigen.");
  }
}
