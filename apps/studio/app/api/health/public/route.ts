import { NextResponse } from "next/server";
import { evaluatePublicHealth, prisma } from "@uwe/database/server";

/** Public uptime probe — plain text only, no internal details. */
export async function GET() {
  const result = await evaluatePublicHealth(prisma);

  return new NextResponse(result.body, {
    status: result.ok ? 200 : 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
