import { NextResponse } from "next/server";
import { createMailRuleService } from "@uwe/mail";
import type { MailRuleAction, MailRuleCondition } from "@uwe/mail";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailApi, requireBrainMailMutation, mailApiError } from "@/src/lib/mail-api";

export async function GET() {
  const auth = await requireBrainMailApi();
  if (auth.error) return auth.error;

  const service = createMailRuleService(brainPrisma);
  const [rules, vips] = await Promise.all([service.listRules(), service.listVips()]);
  return NextResponse.json({ rules, vips });
}

export async function POST(request: Request) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

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

  if (!body.name?.trim()) return mailApiError("name ist erforderlich.");
  if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
    return mailApiError("Mindestens eine Bedingung ist erforderlich.");
  }
  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return mailApiError("Mindestens eine Aktion ist erforderlich.");
  }

  const service = createMailRuleService(brainPrisma);
  const rule = await service.createRule({
    name: body.name,
    enabled: body.enabled,
    sortOrder: body.sortOrder,
    accountId: body.accountId ?? null,
    conditions: body.conditions,
    actions: body.actions,
  });
  return NextResponse.json({ rule }, { status: 201 });
}
