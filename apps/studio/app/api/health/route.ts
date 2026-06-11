import { NextResponse } from "next/server";
import { databaseHealthCheck } from "@uwe/database/server";

export async function GET() {
  const db = await databaseHealthCheck();

  return NextResponse.json({
    status: "ok",
    app: "UWE Studio",
    product: "Universeller Welten-Editor",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    checks: {
      database: db,
    },
  });
}
