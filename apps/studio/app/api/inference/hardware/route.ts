import { NextResponse } from "next/server";
import { estimateHardwareFit } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const rtxUrl = process.env.RTX_AGENT_URL?.trim();
  const rtxToken = process.env.RTX_AGENT_TOKEN?.trim();
  if (!rtxUrl) {
    return NextResponse.json({ available: false, message: "RTX_AGENT_URL nicht konfiguriert." });
  }

  try {
    const headers: Record<string, string> = {};
    if (rtxToken) {
      headers.Authorization = `Bearer ${rtxToken}`;
    }
    const response = await fetch(`${rtxUrl.replace(/\/$/, "")}/api/hardware`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return NextResponse.json({ available: false, message: `RTX Agent HTTP ${response.status}` });
    }
    const hardware = (await response.json()) as {
      totalRamGb: number;
      freeRamGb: number;
      cpus: number;
      gpu?: string;
    };

    const { searchParams } = new URL(request.url);
    const modelSizeGb = Number(searchParams.get("modelSizeGb") ?? "8");
    const fit = estimateHardwareFit(hardware.totalRamGb, modelSizeGb);

    return NextResponse.json({
      available: true,
      hardware,
      fit,
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      message: error instanceof Error ? error.message : "Hardware-Abfrage fehlgeschlagen.",
    });
  }
}
