import type { ZodError } from "zod";

export type ApiErrorBody = {
  error: string;
  details?: unknown;
};

function jsonResponse(body: ApiErrorBody, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/** Safe JSON error — never exposes stack traces or secrets. */
export function apiError(message: string, status: number, details?: unknown): Response {
  const body: ApiErrorBody = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  return jsonResponse(body, status);
}

export function validationError(error: ZodError): Response {
  return apiError("Ungültige Anfrage.", 400, error.flatten().fieldErrors);
}

export function unauthorized(message = "Nicht authentifiziert."): Response {
  return apiError(message, 401);
}

export function forbidden(message = "Zugriff verweigert."): Response {
  return apiError(message, 403);
}

export function rateLimitError(retryAfterSeconds: number): Response {
  return jsonResponse(
    { error: "Zu viele Anfragen. Bitte warte einen Moment." },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export function csrfError(): Response {
  return forbidden("Cross-Origin-Anfragen sind nicht erlaubt.");
}

/** Maps unknown errors to a safe client message — no stack traces. */
export function safeHandlerError(error: unknown, fallback = "Interner Fehler."): Response {
  if (error instanceof Error && error.message && !looksLikeSecret(error.message)) {
    return apiError(error.message, 500);
  }
  return apiError(fallback, 500);
}

function looksLikeSecret(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("secret") ||
    lower.includes("password") ||
    lower.includes("token") ||
    lower.includes("api_key") ||
    lower.includes("stack") ||
    lower.includes("prisma")
  );
}

export class AiAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiAccessDeniedError";
  }
}

export class AiPolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPolicyViolationError";
  }
}
