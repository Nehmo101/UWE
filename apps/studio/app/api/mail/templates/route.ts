import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailTemplateService,
  prisma,
} from "@uwe/database/server";
import {
  guardStudioMutation,
  idSchema,
  nonEmptyString,
  optionalString,
  parseBody,
  requireStudioApiAuth,
} from "@uwe/security";
import { z } from "zod";

const mailTemplateCreateSchema = z.object({
  worldId: idSchema,
  name: nonEmptyString.max(200),
  subject: nonEmptyString.max(500),
  description: optionalString,
  bodyHtml: optionalString,
  bodyText: optionalString,
  slug: optionalString,
  kind: z.literal("custom").optional(),
});

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
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailTemplateCreateSchema);
  if (!parsed.success) return parsed.response;

  const template = await createMailTemplateService(prisma).createTemplate(parsed.data.worldId, {
    name: parsed.data.name,
    subject: parsed.data.subject,
    description: parsed.data.description ?? "",
    bodyHtml: parsed.data.bodyHtml ?? "",
    bodyText: parsed.data.bodyText ?? "",
    slug: parsed.data.slug,
    kind: parsed.data.kind,
  });

  return NextResponse.json({ template }, { status: 201 });
}
