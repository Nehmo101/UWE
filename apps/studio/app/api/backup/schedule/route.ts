import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  readBackupScheduleConfig,
  writeBackupScheduleConfig,
  type BackupScheduleConfig,
} from "@uwe/backup";
import { parseBody } from "@uwe/security";
import { z } from "zod";
import { getUserFromRequestCookieHeader } from "../../../../src/lib/auth-session";

/** Spiegelt BackupScheduleConfig aus @uwe/backup — beide Felder sind Teil-Updates. */
const backupScheduleBodySchema = z.object({
  enabled: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const schedule = readBackupScheduleConfig();
  return NextResponse.json({ schedule });
}

export async function PUT(request: Request) {
  // Konfigurations-Schreibpfad wie die übrigen Backup-/Admin-Routen takten.
  const authError = await guardStudioApiRequest(request, { rateLimit: "setup" });
  if (authError) return authError;

  const user = await getUserFromRequestCookieHeader(request.headers.get("cookie"));
  if (!user?.isOwner) {
    return NextResponse.json(
      { error: "Nur OWNER darf den Backup-Zeitplan ändern." },
      { status: 403 },
    );
  }

  const parsed = await parseBody(request, backupScheduleBodySchema);
  if (!parsed.success) return parsed.response;

  const current = readBackupScheduleConfig();
  const updated: BackupScheduleConfig = {
    enabled: parsed.data.enabled ?? current.enabled,
    frequency: parsed.data.frequency ?? current.frequency,
  };

  writeBackupScheduleConfig(updated);
  return NextResponse.json({ schedule: updated });
}
