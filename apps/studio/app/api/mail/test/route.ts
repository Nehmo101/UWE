import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as { email: unknown }).email ?? "").trim()
      : "";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse erforderlich." }, { status: 400 });
  }

  const mail = createMailService(prisma);
  const result = await mail.sendTestMail(email);
  const payload = {
    ok: result.ok,
    logId: result.log.id,
    error: result.error ?? null,
  };

  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload, { status: result.ok ? 200 : 502 });
}
