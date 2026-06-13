import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailComposeService,
  prisma,
} from "@uwe/database/server";
import type { MailComposeKind } from "@uwe/mail";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

const COMPOSE_KINDS = new Set<MailComposeKind>(["session_recap", "handout", "share_link"]);

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
  const kind = String(payload.kind ?? "") as MailComposeKind;
  const worldSlug = String(payload.worldSlug ?? "").trim();
  const sourceId = String(payload.sourceId ?? "").trim();

  if (!COMPOSE_KINDS.has(kind)) {
    return NextResponse.json({ error: "Ungültiger Compose-Typ." }, { status: 400 });
  }
  if (!worldSlug || !sourceId) {
    return NextResponse.json({ error: "worldSlug und sourceId erforderlich." }, { status: 400 });
  }

  const compose = createMailComposeService(prisma);
  const draft = await compose.compose(
    kind,
    worldSlug,
    sourceId,
    process.env.NEXT_PUBLIC_PORTAL_URL,
  );

  if (!draft) {
    return NextResponse.json({ error: "Quelle nicht gefunden." }, { status: 404 });
  }

  const response = { draft };
  assertMailApiResponseHasNoSecrets(response);
  return NextResponse.json(response);
}
