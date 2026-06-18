import { NextResponse } from "next/server";
import { createMailAccountService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const service = createMailAccountService(prisma);
  const accounts = await service.listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
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
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.label || !body.smtpHost || !body.username || !body.password) {
    return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
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
