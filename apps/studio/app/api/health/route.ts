import { NextResponse } from "next/server";
import { databaseHealthCheck, UWE_PRODUCT_NAME, UWE_VERSION } from "@uwe/database/server";

export async function GET() {
  const db = await databaseHealthCheck();

  return NextResponse.json({
    status: "ok",
    app: "UWE Studio",
    product: UWE_PRODUCT_NAME,
    version: UWE_VERSION,
    timestamp: new Date().toISOString(),
    checks: {
      database: db,
    },
  });
}
