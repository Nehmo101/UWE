import { NextResponse } from "next/server";
import { databaseHealthCheck, UWE_PRODUCT_NAME, UWE_VERSION } from "@uwe/database/server";

export async function GET() {
  const db = await databaseHealthCheck();

  return NextResponse.json({
    status: db.status === "ok" ? "ok" : "degraded",
    app: "UWE Portal",
    product: UWE_PRODUCT_NAME,
    version: UWE_VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      portal: { status: "ok", message: "Portal is running" },
      database: db,
    },
  });
}
