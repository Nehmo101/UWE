import { NextResponse } from "next/server";
import {
  AUDIT_ACTION_LABELS,
  createAuditLogService,
  prisma,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["admin_read"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");

  const audit = createAuditLogService(prisma);
  const entries = await audit.list({
    limit: Number.isFinite(limit) ? limit : 20,
    offset: 0,
  });

  const nlEntries = entries
    .filter((entry) => {
      const metadata = entry.metadataJson as Record<string, unknown> | null;
      return metadata?.source === "nl_command";
    })
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      actorUserId: entry.actorUserId,
      action: entry.action,
      actionLabel: AUDIT_ACTION_LABELS[entry.action],
      intent:
        typeof (entry.metadataJson as Record<string, unknown> | null)?.intent === "string"
          ? ((entry.metadataJson as Record<string, unknown>).intent as string)
          : null,
      summary:
        typeof (entry.metadataJson as Record<string, unknown> | null)?.summary === "string"
          ? ((entry.metadataJson as Record<string, unknown>).summary as string)
          : null,
      readOnly: Boolean(
        (entry.metadataJson as Record<string, unknown> | null)?.readOnly,
      ),
    }));

  return NextResponse.json({ entries: nlEntries });
}
