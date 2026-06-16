/**
 * UWE protected APIs default to same-origin — no wildcard CORS headers.
 * Browsers block cross-origin reads without explicit ACAO; we never emit `*`.
 */

export function sameOriginCorsHeaders(request: Request): HeadersInit | undefined {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || origin === "null" || !host) {
    return undefined;
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

/** Preflight for same-origin only — rejects foreign origins. */
export function handleSameOriginPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return new Response(null, { status: 204 });
  }

  try {
    if (new URL(origin).host !== host) {
      return new Response(JSON.stringify({ error: "Cross-Origin-Anfragen sind nicht erlaubt." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Ungültiger Origin." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    },
  });
}
