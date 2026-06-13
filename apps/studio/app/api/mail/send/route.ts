import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

function parseRecipients(value: unknown): Array<{ email: string; name?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const email = String((entry as { email?: unknown }).email ?? "").trim();
      const name = String((entry as { name?: unknown }).name ?? "").trim();
      if (!email.includes("@")) {
        return null;
      }
      return name ? { email, name } : { email };
    })
    .filter((entry): entry is { email: string; name?: string } => entry !== null);
}

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request-Body muss ein JSON-Objekt sein." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const to = parseRecipients(payload.to);
  const subject = String(payload.subject ?? "").trim();
  const bodyText = String(payload.bodyText ?? "").trim();
  const bodyHtml = String(payload.bodyHtml ?? "").trim() || undefined;

  if (to.length === 0) {
    return NextResponse.json({ error: "Mindestens ein Empfänger erforderlich." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Betreff erforderlich." }, { status: 400 });
  }
  if (!bodyText && !bodyHtml) {
    return NextResponse.json({ error: "Nachrichtentext erforderlich." }, { status: 400 });
  }

  const mail = createMailService(prisma);
  const result = await mail.sendMail({
    to,
    subject,
    bodyText: bodyText || bodyHtml || "",
    bodyHtml,
    worldId: payload.worldId ? String(payload.worldId) : null,
    templateId: payload.templateId ? String(payload.templateId) : null,
    sourceType: payload.sourceType ? String(payload.sourceType) : null,
    sourceId: payload.sourceId ? String(payload.sourceId) : null,
    confirmDmOnly: payload.confirmDmOnly === true,
    containsDmOnlyHint: payload.containsDmOnlyHint === true,
  });

  const response = {
    ok: result.ok,
    logId: result.log.id,
    error: result.error ?? null,
  };

  assertMailApiResponseHasNoSecrets(response);
  return NextResponse.json(response, { status: result.ok ? 200 : 502 });
}
