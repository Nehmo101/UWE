import { NextResponse } from "next/server";
import { getAppRepository, validateSettingsUpdate } from "@uwe/database/server";
import { requireStudioApiAuth } from "../../../src/lib/studio-api-auth";

export async function GET() {
  const settings = await getAppRepository().getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateSettingsUpdate(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Ungültige Einstellungen", details: validation.errors },
      { status: 400 },
    );
  }

  const settings = await getAppRepository().updateSystemSettings(validation.value);
  return NextResponse.json({ settings });
}
