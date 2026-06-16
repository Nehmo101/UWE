import { NextResponse } from "next/server";
import { logAuditEvent, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

/**
 * Records that an admin explicitly revealed a masked secret in the UI.
 * Does not return the secret value — only logs the audit event.
 */
export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { secretType?: string; targetId?: string; worldId?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.secretType?.trim()) {
    return NextResponse.json({ error: "secretType ist erforderlich." }, { status: 400 });
  }

  await logAuditEvent(prisma, {
    action: "secret_revealed",
    targetType: "settings",
    targetId: body.targetId ?? null,
    worldId: body.worldId ?? null,
    metadata: {
      secretType: body.secretType,
      revealedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, masked: "••••••••" });
}
