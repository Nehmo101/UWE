import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiMutation } from "@/src/lib/studio-admin-auth";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { emailSchema, idSchema, nonEmptyString, optionalString, parseBody } from "@uwe/security";
import { z } from "zod";

const mailRecipientSchema = z.object({
  email: emailSchema,
  name: optionalString,
});

const mailSendBodySchema = z.object({
  to: z.array(mailRecipientSchema).min(1),
  subject: nonEmptyString.max(500),
  bodyText: optionalString,
  bodyHtml: optionalString,
  worldId: idSchema.optional().nullable(),
  templateId: idSchema.optional().nullable(),
  sourceType: optionalString,
  sourceId: idSchema.optional().nullable(),
  confirmDmOnly: z.boolean().optional(),
  containsDmOnlyHint: z.boolean().optional(),
});

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailSendBodySchema);
  if (!parsed.success) return parsed.response;

  const { to, subject, bodyText, bodyHtml, ...rest } = parsed.data;

  if (!bodyText?.trim() && !bodyHtml?.trim()) {
    return jsonError("Nachrichtentext erforderlich.", 400);
  }

  const mail = createMailService(prisma);
  const result = await mail.sendMail({
    to: to.map((entry) => (entry.name ? { email: entry.email, name: entry.name } : { email: entry.email })),
    subject,
    bodyText: bodyText?.trim() || bodyHtml?.trim() || "",
    bodyHtml: bodyHtml?.trim() || undefined,
    worldId: rest.worldId ?? null,
    templateId: rest.templateId ?? null,
    sourceType: rest.sourceType ?? null,
    sourceId: rest.sourceId ?? null,
    confirmDmOnly: rest.confirmDmOnly === true,
    containsDmOnlyHint: rest.containsDmOnlyHint === true,
  });

  const response = {
    ok: result.ok,
    logId: result.log.id,
    error: result.error ?? null,
  };

  assertMailApiResponseHasNoSecrets(response);
  return NextResponse.json(response, { status: result.ok ? 200 : 502 });
}
