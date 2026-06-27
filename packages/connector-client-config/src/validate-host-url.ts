export interface HostUrlValidationOk {
  ok: true;
  normalized: string;
}

export interface HostUrlValidationError {
  ok: false;
  reason: string;
}

export type HostUrlValidationResult = HostUrlValidationOk | HostUrlValidationError;

/**
 * Validate and normalize a UWE Host URL for the connector client.
 * Accepts http/https only; strips trailing slashes.
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

  return { ok: true, normalized: trimmed.replace(/\/+$/, "") };
}
