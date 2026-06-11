import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "UWE Portal",
    product: "Universeller Welten-Editor",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    checks: {
      portal: { status: "ok", message: "Portal is running" },
    },
  });
}
