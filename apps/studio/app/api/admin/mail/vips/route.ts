import { NextResponse } from "next/server";
import { createMailRuleService } from "@uwe/mail";
import { requireAdminMailApi, requireAdminMailMutation, mailApiError } from "@/src/lib/admin-mail-api";
import { brainPrisma } from "@uwe/database/brain-client";

export async function GET(request: Request) {
  const auth = await requireAdminMailApi(request);
  if (auth.error) return auth.error;

  const service = createMailRuleService(brainPrisma);
  const vips = await service.listVips();
  return NextResponse.json({ vips });
}

export async function POST(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  let body: { address?: string; label?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }
  if (!body.address?.trim()) return mailApiError("address ist erforderlich.");

  const service = createMailRuleService(brainPrisma);
  const vip = await service.addVip(body.address, body.label ?? null);
  return NextResponse.json({ vip }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return mailApiError("id ist erforderlich.");

  const service = createMailRuleService(brainPrisma);
  await service.removeVip(id);
  return NextResponse.json({ ok: true });
}
