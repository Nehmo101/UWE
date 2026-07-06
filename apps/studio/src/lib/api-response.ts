import { NextResponse } from "next/server";
import { apiError, type ApiErrorBody } from "@uwe/security";

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
