import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createMailAccountService, prisma } from "@uwe/database/server";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const service = createMailAccountService(prisma);
  const accounts = await service.listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  let body: {
    label?: string;
    smtpHost?: string;
    username?: string;
    password?: string;
    imapHost?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  if (!body.label || !body.smtpHost || !body.username || !body.password) {
    return jsonError("Pflichtfelder fehlen.", 400);
  }

  const service = createMailAccountService(prisma);
  const account = await service.createAccount({
    label: body.label,
    smtpHost: body.smtpHost,
    username: body.username,
    password: body.password,
    imapHost: body.imapHost,
  });

  return NextResponse.json({
    account: {
      id: account.id,
      label: account.label,
      smtpHost: account.smtpHost,
      username: account.username,
      imapHost: account.imapHost,
    },
  });
}
