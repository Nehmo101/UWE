import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { sanitizeMailBodyHtml } from "@uwe/mail/sanitize";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailApi, mailApiError } from "@/src/lib/mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireBrainMailApi();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(brainPrisma);
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
