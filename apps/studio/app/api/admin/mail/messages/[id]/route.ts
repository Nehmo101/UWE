import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailApi, mailApiError } from "@/src/lib/admin-mail-api";
import { sanitizeMailBodyHtml } from "@/src/lib/sanitize-html";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(prisma);
  const [message, thread] = await Promise.all([
    service.getMessage(id, auth.user?.id),
    service.getThreadForMessage(id),
  ]);
  if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

  // `bodyHtmlRaw` is unsanitized MIME output — never let it leave the server.
  // Render callers get `bodySafeHtml` (DOMPurify + tracking-pixel blocking) instead.
  const { bodyHtmlRaw, ...safeMessage } = message;
  const bodySafeHtml = bodyHtmlRaw ? sanitizeMailBodyHtml(bodyHtmlRaw, { messageId: id }) : null;

  // Only expose the thread when it has more than the message itself.
  const threadEntries = thread.length > 1 ? thread : [];

  return NextResponse.json({ message: { ...safeMessage, bodySafeHtml }, thread: threadEntries });
}
