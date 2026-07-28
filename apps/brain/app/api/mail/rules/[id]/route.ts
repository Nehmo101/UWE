import { NextResponse } from "next/server";
import { createMailRuleService } from "@uwe/mail";
import type { MailRuleAction, MailRuleCondition } from "@uwe/mail";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  let body: {
    name?: string;
    enabled?: boolean;
    sortOrder?: number;
    accountId?: string | null;
    conditions?: MailRuleCondition[];
    actions?: MailRuleAction[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mailApiError("Ungültiger JSON-Body.");
  }

  const service = createMailRuleService(brainPrisma);
  const rule = await service.updateRule(id, body);
  return NextResponse.json({ rule });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;
  const { id } = await context.params;

  const service = createMailRuleService(brainPrisma);
  await service.deleteRule(id);
  return NextResponse.json({ ok: true });
}
