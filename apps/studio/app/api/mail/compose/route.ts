import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailComposeService,
  prisma,
} from "@uwe/database/server";
import type { MailComposeKind } from "@uwe/mail";
import {
  guardStudioMutation,
  idSchema,
  parseBody,
  slugSchema,
} from "@uwe/security";
import { z } from "zod";

const COMPOSE_KINDS = ["session_recap", "handout", "share_link"] as const;

const mailComposeBodySchema = z.object({
  kind: z.enum(COMPOSE_KINDS),
  worldSlug: slugSchema,
  sourceId: idSchema,
});

export async function POST(request: Request) {
  const authError = guardStudioMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailComposeBodySchema);
  if (!parsed.success) return parsed.response;

  const compose = createMailComposeService(prisma);
  const draft = await compose.compose(
    parsed.data.kind as MailComposeKind,
    parsed.data.worldSlug,
    parsed.data.sourceId,
    process.env.NEXT_PUBLIC_PORTAL_URL,
  );

  if (!draft) {
    return NextResponse.json({ error: "Quelle nicht gefunden." }, { status: 404 });
  }

  const response = { draft };
  assertMailApiResponseHasNoSecrets(response);
  return NextResponse.json(response);
}
