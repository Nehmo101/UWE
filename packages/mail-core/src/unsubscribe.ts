export interface ParsedUnsubscribeTargets {
  httpUrl: string | null;
  mailto: string | null;
}

const ANGLE_BRACKET_TARGET = /<([^>]+)>/g;

/** Extracts the HTTP(S) and mailto: targets from a `List-Unsubscribe` header value (RFC 2369/8058). */
export function parseListUnsubscribeHeader(headerValue: string | null | undefined): ParsedUnsubscribeTargets {
  if (!headerValue) return { httpUrl: null, mailto: null };
  const targets = [...headerValue.matchAll(ANGLE_BRACKET_TARGET)].map((match) => match[1].trim());
  return {
    httpUrl: targets.find((target) => /^https?:\/\//i.test(target)) ?? null,
    mailto: targets.find((target) => /^mailto:/i.test(target)) ?? null,
  };
}

/** True if the sender opted into RFC 8058 one-click unsubscribe via `List-Unsubscribe-Post`. */
export function supportsOneClickUnsubscribe(postHeaderValue: string | null | undefined): boolean {
  if (!postHeaderValue) return false;
  return /list-unsubscribe=one-click/i.test(postHeaderValue);
}

export interface ParsedMailtoTarget {
  to: string;
  subject: string | null;
  body: string | null;
}

/** Splits a `mailto:` unsubscribe target into recipient plus optional subject/body query params. */
export function parseMailtoTarget(mailto: string): ParsedMailtoTarget {
  const withoutScheme = mailto.replace(/^mailto:/i, "");
  const [address, query = ""] = withoutScheme.split("?");
  const params = new URLSearchParams(query);
  return {
    to: decodeURIComponent(address),
    subject: params.get("subject"),
    body: params.get("body"),
  };
}

export interface HttpUnsubscribeResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Fires the RFC 8058 one-click POST — the standard, non-destructive way to unsubscribe. */
export async function executeHttpOneClickUnsubscribe(url: string): Promise<HttpUnsubscribeResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Netzwerkfehler." };
  }
}
