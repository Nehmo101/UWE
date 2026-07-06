import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import {
  assertMailApiResponseHasNoSecrets,
  createMailComposeService,
  prisma,
} from "@uwe/database/server";
import type { MailComposeKind } from "@uwe/mail";
import { idSchema, optionalString, parseBody, slugSchema } from "@uwe/security";
import { z } from "zod";

const COMPOSE_KINDS = [
  "session_recap",
  "session_reminder",
  "handout",
  "share_link",
  "contract_reminder",
  "backup_warning",
  "system_warning",
  "terrain_rental",
] as const;

const mailComposeBodySchema = z.object({
  kind: z.enum(COMPOSE_KINDS),
  worldSlug: slugSchema.optional(),
  sourceId: idSchema.optional(),
  title: optionalString,
  message: optionalString,
});

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailComposeBodySchema);
  if (!parsed.success) return parsed.response;

  const compose = createMailComposeService(prisma);
  const draft = await compose.compose(parsed.data.kind as MailComposeKind, {
    worldSlug: parsed.data.worldSlug,
    sourceId: parsed.data.sourceId,
    portalBaseUrl: process.env.NEXT_PUBLIC_PORTAL_URL,
    title: parsed.data.title ?? undefined,
    message: parsed.data.message ?? undefined,
  });

  if (!draft) {
    return jsonError("Quelle nicht gefunden.", 404);
  }

  const response = { draft };
  assertMailApiResponseHasNoSecrets(response);
  return NextResponse.json(response);
}
