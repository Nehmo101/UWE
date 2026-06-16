import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Private health requires STUDIO_API_TOKEN on every request.
 * Same-origin browser access is intentionally not enough — details belong
 * to operators with the token (Owner/Admin monitoring, curl, systemd checks).
 */
export function requirePrivateHealthAuth(request: Request): NextResponse | null {
  const requiredToken = process.env.STUDIO_API_TOKEN?.trim();
  if (!requiredToken) {
    return NextResponse.json(
      {
        error:
          "STUDIO_API_TOKEN ist nicht gesetzt — privater Healthcheck in Production deaktiviert.",
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
    return NextResponse.json({ error: "Ungültiges Studio-API-Token." }, { status: 401 });
  }

  return null;
}
