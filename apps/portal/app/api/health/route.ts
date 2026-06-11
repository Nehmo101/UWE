import { NextResponse } from "next/server";
import { databaseHealthCheck } from "@uwe/database/server";

export async function GET() {
  const db = await databaseHealthCheck();

  return NextResponse.json({
    status: db.status === "ok" ? "ok" : "degraded",
    app: "UWE Portal",
    product: "Universeller Welten-Editor",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    checks: {
      portal: { status: "ok", message: "Portal is running" },
      database: db,
    },
  });
}
