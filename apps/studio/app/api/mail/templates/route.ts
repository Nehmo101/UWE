import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailTemplateService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldId = url.searchParams.get("worldId") ?? undefined;
  const templates = await createMailTemplateService(prisma).listTemplates({
    worldId: worldId ?? null,
  });

  const payload = { templates };
  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
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
  const worldId = String(payload.worldId ?? "").trim();
  const name = String(payload.name ?? "").trim();
  const subject = String(payload.subject ?? "").trim();

  if (!worldId || !name || !subject) {
    return NextResponse.json({ error: "worldId, name und subject erforderlich." }, { status: 400 });
  }

  const template = await createMailTemplateService(prisma).createTemplate(worldId, {
    name,
    subject,
    description: String(payload.description ?? ""),
    bodyHtml: String(payload.bodyHtml ?? ""),
    bodyText: String(payload.bodyText ?? ""),
    slug: payload.slug ? String(payload.slug) : undefined,
    kind: payload.kind ? (String(payload.kind) as "custom") : undefined,
  });

  return NextResponse.json({ template }, { status: 201 });
}
