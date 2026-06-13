/**
 * Blocks public Ollama/LM Studio endpoints unless explicitly allowed.
 * RTX inference must stay on private/home-network addresses.
 */

export type InferenceUrlKind = "loopback" | "private" | "link_local" | "public";

export class InferenceUrlBlockedError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly kind: InferenceUrlKind,
  ) {
    super(message);
    this.name = "InferenceUrlBlockedError";
  }
}

const PRIVATE_IPV4_RANGES: Array<{ prefix: number; mask: number }> = [
  { prefix: ipv4ToInt("10.0.0.0"), mask: 8 },
  { prefix: ipv4ToInt("172.16.0.0"), mask: 12 },
  { prefix: ipv4ToInt("192.168.0.0"), mask: 16 },
  { prefix: ipv4ToInt("127.0.0.0"), mask: 8 },
  { prefix: ipv4ToInt("169.254.0.0"), mask: 16 },
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((part) => Number(part));
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const octets = match.slice(1, 5).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) {
    return false;
  }

  const value = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;

  return PRIVATE_IPV4_RANGES.some(({ prefix, mask }) => {
    const maskBits = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (value & maskBits) === (prefix & maskBits);
  });
}

export function classifyInferenceUrl(url: string): InferenceUrlKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "public";
  }

  const hostname = parsed.hostname.toLowerCase();

  if (LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    return "loopback";
  }

  if (hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return "link_local";
  }

  if (isPrivateIpv4(hostname)) {
    if (hostname.startsWith("169.254.")) {
      return "link_local";
    }
    if (hostname.startsWith("127.")) {
      return "loopback";
    }
    return "private";
  }

  return "public";
}

export function isInferenceUrlAllowed(url: string, allowPublicUrl: boolean): boolean {
  if (allowPublicUrl) {
    return true;
  }

  const kind = classifyInferenceUrl(url);
  return kind === "loopback" || kind === "private" || kind === "link_local";
}

export function assertInferenceUrlAllowed(url: string, allowPublicUrl: boolean): void {
  if (isInferenceUrlAllowed(url, allowPublicUrl)) {
    return;
  }

  const kind = classifyInferenceUrl(url);
  throw new InferenceUrlBlockedError(
    `Inference-Endpoint ist öffentlich erreichbar (${kind}). ` +
      "RTX/Ollama/LM Studio dürfen nur im Heimnetz genutzt werden. " +
      "Setze eine private IP (z. B. 192.168.x.x) oder AI_INFERENCE_ALLOW_PUBLIC_URL=true nur bewusst für Tests.",
    url,
    kind,
  );
}

/** Safe host label for health/status responses — no credentials or paths. */
export function sanitizeInferenceEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}`;
  } catch {
    return "(ungültige URL)";
  }
}
