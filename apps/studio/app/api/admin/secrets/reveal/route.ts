import { guardStudioAdminApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { logAuditEvent, prisma } from "@uwe/database/server";

/**
 * Records that an admin explicitly revealed a masked secret in the UI.
 * Does not return the secret value — only logs the audit event.
 */
export async function POST(request: Request) {
  const { error: authError } = await guardStudioAdminApiRequest(request);
  if (authError) return authError;

  let body: { secretType?: string; targetId?: string; worldId?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.secretType?.trim()) {
    return jsonError("secretType ist erforderlich.", 400);
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
