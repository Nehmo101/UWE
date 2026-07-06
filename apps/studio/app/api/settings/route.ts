import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { getAppRepository, validateSettingsUpdate } from "@uwe/database/server";
import { parseBody, passthroughBodySchema } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const settings = await getAppRepository().getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const authError = await guardStudioApiMutation(request, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, passthroughBodySchema);
  if (!parsed.success) return parsed.response;

  const validation = validateSettingsUpdate(parsed.data);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Ungültige Einstellungen", details: validation.errors },
      { status: 400 },
    );
  }

  const settings = await getAppRepository().updateSystemSettings(validation.value);
  return NextResponse.json({ settings });
}
