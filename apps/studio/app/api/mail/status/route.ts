import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const mail = createMailService(prisma);
  const status = await mail.getConfigStatus();
  const payload = { status };

  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}
