export interface HostUrlValidationOk {
  ok: true;
  normalized: string;
}

export interface HostUrlValidationError {
  ok: false;
  reason: string;
}

export type HostUrlValidationResult = HostUrlValidationOk | HostUrlValidationError;

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }

  const octets = normalized.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.slice(1).every((octet) => /^(?:0|[1-9]\d{0,2})$/.test(octet) && Number(octet) <= 255)
  );
}

/**
 * Validate and normalize a UWE Host URL for the connector client.
 * Remote hosts must use HTTPS because the connector sends its bearer token and
 * local inference payloads to the host. Plain HTTP remains available for
 * explicit loopback development targets only; trailing slashes are stripped.
 */
export function validateHostUrl(url: string): HostUrlValidationResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, reason: "Host-URL darf nicht leer sein." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: `Host-URL ist ungültig: ${trimmed}` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Host-URL muss http:// oder https:// verwenden." };
  }

  if (parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname)) {
    return {
      ok: false,
      reason: "Remote Host-URLs müssen https:// verwenden; http:// ist nur für Loopback erlaubt.",
    };
  }

  return { ok: true, normalized: trimmed.replace(/\/+$/, "") };
}
