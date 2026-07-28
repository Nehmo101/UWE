import { NextResponse } from "next/server";

/**
 * Public liveness probe for Brain. Deliberately minimal: Brain is gated, so
 * the unauthenticated endpoint reveals nothing beyond "the process is up" — no
 * database, migration or config detail. The full, owner-gated health report lives
 * at /api/health/private, behind the brain checkbox. Listed in BRAIN_PUBLIC_ROUTES
 * and in BRAIN_PUBLIC_API_ALLOWLIST (the route-auth inventory).
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok", app: "UWE Brain", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
