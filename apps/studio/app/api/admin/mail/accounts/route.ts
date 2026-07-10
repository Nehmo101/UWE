import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailApi, requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const service = createMailPortalService(prisma);
  const accounts = await service.listAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: {
    label?: string;
    providerPreset?: "gmail" | "outlook" | "generic";
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
    username?: string;
    password?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  if (!body.label?.trim() || !body.username?.trim() || !body.password) {
    return mailApiError("label, username und password sind erforderlich.");
  }

  const service = createMailPortalService(prisma);
  const account = await service.createAccount(
    {
      label: body.label,
      providerPreset: body.providerPreset ?? "generic",
      smtpHost: body.smtpHost ?? "",
      smtpPort: body.smtpPort,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      username: body.username,
      password: body.password,
    },
    auth.user?.id,
  );

  return NextResponse.json({ account }, { status: 201 });
}
