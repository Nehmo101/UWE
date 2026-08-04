import { NextResponse } from "next/server";
import { apiError, type ApiErrorBody } from "@uwe/security/errors";

export type { ApiErrorBody };

/** Canonical Studio JSON error shape — matches @uwe/security `ApiErrorBody`. */
export function jsonError(message: string, status = 400, details?: unknown) {
  const body: ApiErrorBody = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export { apiError };

/**
 * Menschenlesbare Meldung aus einem unknown-Fehler — ersetzt das verstreute
 * `error instanceof Error ? error.message : "…"`-Muster in Actions/Handlern.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Fehler-Ergebnis für Server Actions im bestandsüblichen
 * `{ ok: false, error }`-Shape (siehe z. B. terra-actions.ts).
 */
export function actionError(error: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: errorMessage(error, fallback) };
}

/** 404 für den häufigsten Fehlerfall: der Welt-Slug existiert nicht. */
export function worldNotFound() {
  return jsonError("Welt nicht gefunden.", 404);
}
