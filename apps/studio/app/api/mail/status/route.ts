import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
  prisma,
} from "@uwe/database/server";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const mail = createMailService(prisma);
  const status = await mail.getConfigStatus();
  const payload = { status };

  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}
