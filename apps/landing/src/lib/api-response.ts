import { NextResponse } from "next/server";
import { apiError, type ApiErrorBody } from "@uwe/security/errors";

export type { ApiErrorBody };

/** Kanonische JSON-Fehlerform der Landing — identisch zu Studio und Portal. */
export function jsonError(message: string, status = 400, details?: unknown) {
  const body: ApiErrorBody = { error: message };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export { apiError };
