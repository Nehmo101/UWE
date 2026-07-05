import { NextResponse } from "next/server";
import { createMailPortalService, prisma } from "@uwe/database/server";
import { requireAdminMailApi, mailApiError } from "@/src/lib/admin-mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_PREFIX = /^image\//i;

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const url = new URL(request.url);
  const remoteUrl = url.searchParams.get("url");
  if (!remoteUrl) return mailApiError("url erforderlich.", 400);

  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    return mailApiError("Ungültige URL.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return mailApiError("Nur http(s)-URLs erlaubt.", 400);
  }

  const message = await createMailPortalService(prisma).getMessageContent(id);
  if (!message) return mailApiError("Nachricht nicht gefunden.", 404);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    });
    if (!response.ok) {
      return mailApiError(`Bild konnte nicht geladen werden (HTTP ${response.status}).`, 502);
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (!ALLOWED_IMAGE_PREFIX.test(contentType)) {
      return mailApiError("Antwort ist kein Bild.", 415);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) {
      return mailApiError("Bild zu groß.", 413);
    }
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return mailApiError("Bild konnte nicht geladen werden.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
