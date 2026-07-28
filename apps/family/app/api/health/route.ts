import { NextResponse } from "next/server";

/**
 * Public liveness probe for Family. Deliberately minimal: Family is gated, so
 * the unauthenticated endpoint reveals nothing beyond "the process is up" — no
 * database, migration or config detail. Listed in FAMILY_PUBLIC_ROUTES.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", app: "UWE Family", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
