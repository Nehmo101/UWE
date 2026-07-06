import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import {
  assertMailApiResponseHasNoSecrets,
  createMailLogService,
  prisma,
} from "@uwe/database/server";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const worldId = url.searchParams.get("worldId") ?? undefined;
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);

  const logs = await createMailLogService(prisma).list({
    worldId,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30,
  });

  const payload = { logs };
  assertMailApiResponseHasNoSecrets(payload);
  return NextResponse.json(payload);
}
