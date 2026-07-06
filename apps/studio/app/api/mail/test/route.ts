import { NextResponse } from "next/server";
import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { emailSchema, parseBody } from "@uwe/security";
import { z } from "zod";

const mailTestBodySchema = z.object({
  email: emailSchema,
});

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const parsed = await parseBody(request, mailTestBodySchema);
  if (!parsed.success) return parsed.response;

  const mail = createMailService(prisma);
  const result = await mail.sendTestMail(parsed.data.email);
  const payload = {
    ok: result.ok,
    logId: result.log.id,
    error: result.error ?? null,
  };

  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload, { status: result.ok ? 200 : 502 });
}
