import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { timingSafeEqual } from "node:crypto";

/**
 * Agent job completion callbacks from GitHub Actions require Bearer STUDIO_API_TOKEN.
 * Same-origin browser access is intentionally not enough.
 */
export function requireAgentJobCallbackAuth(request: Request): NextResponse | null {
  const requiredToken = process.env.STUDIO_API_TOKEN?.trim();
  if (!requiredToken) {
    return NextResponse.json(
      {
        error:
          "STUDIO_API_TOKEN ist nicht gesetzt — Agent-Job-Callbacks sind deaktiviert.",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization: Bearer <STUDIO_API_TOKEN> erforderlich." },
      { status: 401 },
    );
  }

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(requiredToken);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return jsonError("Ungültiges Studio-API-Token.", 401);
  }

  return null;
}
