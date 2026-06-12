import { NextResponse } from "next/server";
import { getAppRepository } from "@uwe/database/server";
import type { UweSystemSettingsUpdate } from "@uwe/database/server";
import { requireStudioApiAuth } from "../../../src/lib/studio-api-auth";

export async function GET() {
  const settings = await getAppRepository().getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: UweSystemSettingsUpdate;

  try {
    body = (await request.json()) as UweSystemSettingsUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const settings = await getAppRepository().updateSystemSettings(body);
  return NextResponse.json({ settings });
}
