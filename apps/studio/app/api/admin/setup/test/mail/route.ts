import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { emailSchema, parseBody, requireOwnerApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";

const bodySchema = z.object({
  email: emailSchema,
});

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireOwnerApiAuth(request, context, { rateLimit: "setup" });
  if (authError) return authError;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.success) return parsed.response;

  const mail = createMailService(prisma);
  const result = await mail.sendTestMail(parsed.data.email);
  const payload = {
    ok: result.ok,
    message: result.ok
      ? "Testmail gesendet (oder im Mock-Modus protokolliert)."
      : (result.error ?? "Testmail fehlgeschlagen."),
    error: result.error ?? null,
  };

  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload, { status: result.ok ? 200 : 502 });
}
