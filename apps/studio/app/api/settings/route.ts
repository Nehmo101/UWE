import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { getAppRepository, validateSettingsUpdate } from "@uwe/database/server";
import { parseBody, systemSettingsUpdateBodySchema } from "@uwe/security";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const settings = await getAppRepository().getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const authError = await guardStudioApiRequest(request, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, systemSettingsUpdateBodySchema);
  if (!parsed.success) return parsed.response;

  // Sektions-Inhalte prüft weiterhin der Domain-Validator — das Zod-Schema
  // sichert nur die äußere Form (bekannte Sektionen, Objekte als Werte).
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
