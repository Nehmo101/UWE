import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailApi, mailApiError } from "@/src/lib/admin-mail-api";
import { brainPrisma } from "@uwe/database/brain-client";

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { id, attachmentId } = await context.params;
  const service = createMailPortalService(brainPrisma, prisma);

  try {
    const fetched = await service.fetchAttachmentContent(id, attachmentId);
    await service.logAudit({
      action: "read",
      messageId: id,
      userId: auth.user?.id,
      detail: `Anhang ${fetched.filename} heruntergeladen`,
    });
    return new NextResponse(new Uint8Array(fetched.content), {
      headers: {
        "Content-Type": fetched.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fetched.filename)}"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download fehlgeschlagen.";
    return mailApiError(message, 502);
  }
}
