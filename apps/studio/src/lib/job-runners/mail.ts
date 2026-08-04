import { createMailService, prisma } from "@uwe/database/server";
import { assertNotCancelled, type JobRunnerContext } from "./context";

interface MailSendJobPayload {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  text?: string;
  html?: string;
  worldId?: string | null;
  templateId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  confirmDmOnly?: boolean;
  containsDmOnlyHint?: boolean;
}

export async function runMailSendJob(ctx: JobRunnerContext): Promise<Record<string, unknown>> {
  const payload = (ctx.job.payload ?? {}) as MailSendJobPayload;
  if (!payload.to?.length || !payload.subject) {
    throw new Error("Mail-Payload unvollständig (Empfänger/Betreff fehlen).");
  }

  const mailService = createMailService(prisma);

  await ctx.jobs.updateProgress(ctx.jobId, 30, "Mail versenden");
  await assertNotCancelled(ctx.jobs, ctx.jobId);

  const outcome = await mailService.sendMail({
    to: payload.to,
    subject: payload.subject,
    bodyText: payload.bodyText ?? payload.text ?? "",
    bodyHtml: payload.bodyHtml ?? payload.html,
    worldId: payload.worldId ?? null,
    templateId: payload.templateId ?? null,
    sourceType: payload.sourceType ?? null,
    sourceId: payload.sourceId ?? null,
    confirmDmOnly: payload.confirmDmOnly,
    containsDmOnlyHint: payload.containsDmOnlyHint,
  });

  if (!outcome.ok) {
    throw new Error(outcome.error ?? "Mail-Versand fehlgeschlagen.");
  }

  return {
    logId: outcome.log.id,
    status: outcome.log.status,
  };
}
