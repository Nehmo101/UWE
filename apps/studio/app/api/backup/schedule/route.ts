import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  readBackupScheduleConfig,
  writeBackupScheduleConfig,
  type BackupScheduleConfig,
} from "@uwe/backup";
import { getUserFromRequestCookieHeader } from "../../../../src/lib/auth-session";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const schedule = readBackupScheduleConfig();
  return NextResponse.json({ schedule });
}

export async function PUT(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user || user.role !== "owner") {
    return NextResponse.json(
      { error: "Nur OWNER darf den Backup-Zeitplan ändern." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<BackupScheduleConfig>;
  const current = readBackupScheduleConfig();
  const updated: BackupScheduleConfig = {
    enabled: body.enabled !== undefined ? body.enabled !== false : current.enabled,
    frequency:
      body.frequency && (["daily", "weekly", "monthly"] as const).includes(body.frequency)
        ? body.frequency
        : current.frequency,
  };

  writeBackupScheduleConfig(updated);
  return NextResponse.json({ schedule: updated });
}
