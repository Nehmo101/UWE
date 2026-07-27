import { mailBodyForProcessing, MAIL_PRIORITY_CATEGORIES } from "@uwe/mail/portal-types";
import type { MailReplyTone } from "@uwe/mail/portal-types";
import { executeAiGatewayRequest, type AiTaskType } from "@uwe/ai-brain";
import { createBrainStoreService, createUweRepository } from "@uwe/database/server";
import {
  parseMailPriorityResponse,
  type MailAiPriorityScore,
} from "./mail-priority-parse";

export type { MailAiPriorityScore };
export { parseMailPriorityResponse };

export interface MailAiUser {
  userId: string;
}

interface MailContentInput {
  subject: string;
  fromAddress: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
}

/**
 * All inbox-mail AI runs through the gateway with contextMode "mail":
 * permanently local-only (no cloud fallback), permission/budget-checked,
 * and logged in the usage log.
 */
async function runMailAi(
  user: MailAiUser,
  taskType: AiTaskType,
  prompt: string,
): Promise<{ text: string; provider: string; model: string }> {
  const routed = await executeAiGatewayRequest(
    {
      repo: createUweRepository(),
      brainStore: createBrainStoreService(),
    },
    {
      user,
      providerMode: "local_rtx",
      contextMode: "mail",
      taskType,
      userPrompt: prompt,
      useMock: process.env.AI_USE_MOCK === "true",
      feature: "AI_SUMMARY_USE",
    },
  );

  return {
    text: routed.result.text.trim(),
    provider: routed.result.provider,
    model: routed.result.model,
  };
}

export async function generateMailSummary(
  input: MailContentInput,
  user?: MailAiUser | null,
): Promise<{ text: string; provider: string; model: string }> {
  const body = mailBodyForProcessing(input.bodyText, input.bodyHtml).slice(0, 4000);

  if (user) {
    try {
      const ai = await runMailAi(
        user,
        "summarize_mail",
        `Fasse diese E-Mail in 2-3 Sätzen zusammen (Deutsch). Betreff: ${input.subject}\nVon: ${input.fromAddress}\n\n${body}`,
      );
      if (ai.text) {
        return ai;
      }
    } catch {
      // fallback below
    }
  }

  return {
    text: body.slice(0, 280) + (body.length > 280 ? "…" : ""),
    provider: "rules",
    model: "truncate-v1",
  };
}

export async function generateMailReplyDraft(
  input: MailContentInput & { tone: MailReplyTone },
  user?: MailAiUser | null,
): Promise<{ text: string; provider: string; model: string }> {
  const body = mailBodyForProcessing(input.bodyText, input.bodyHtml).slice(0, 3000);
  const toneHint =
    input.tone === "short"
      ? "Sehr kurz."
      : input.tone === "friendly"
        ? "Freundlich und warm."
        : input.tone === "direct"
          ? "Direkt und sachlich."
          : "Professionell und höflich.";

  if (user) {
    try {
      const ai = await runMailAi(
        user,
        "prepare_mail_draft",
        `Schreibe einen Antwortentwurf (${toneHint}) auf diese E-Mail. Nur den Antworttext, keine Metadaten.\nBetreff: ${input.subject}\nVon: ${input.fromAddress}\n\n${body}`,
      );
      if (ai.text) {
        return ai;
      }
    } catch {
      // fallback below
    }
  }

  return {
    text: `Hallo,\n\nvielen Dank für Ihre Nachricht zu „${input.subject}“.\n\n[Ihre Antwort hier]\n\nFreundliche Grüße`,
    provider: "template",
    model: "template-v1",
  };
}

/**
 * LLM mail prioritization; returns null when AI is unavailable or the
 * response is unusable — the caller falls back to the rule engine.
 */
export async function generateMailPriority(
  input: MailContentInput & { hasAttachments?: boolean; vipSenders?: string[] },
  user?: MailAiUser | null,
): Promise<MailAiPriorityScore | null> {
  if (!user) return null;

  const body = mailBodyForProcessing(input.bodyText, input.bodyHtml).slice(0, 3000);
  const vipHint = input.vipSenders?.length
    ? `\nVIP-Absender: ${input.vipSenders.join(", ")}`
    : "";

  const prompt = [
    "Bewerte diese E-Mail. Antworte NUR als JSON-Objekt mit den Feldern:",
    `{"priority": 0-100, "category": eine aus [${MAIL_PRIORITY_CATEGORIES.join(", ")}], "confidence": 0-1, "explanation": "kurze deutsche Begründung", "extractedActions": [{"type": "task|deadline|payment", "label": "…", "value": "optional"}]}`,
    "",
    `Betreff: ${input.subject}`,
    `Von: ${input.fromAddress}`,
    `Anhänge: ${input.hasAttachments ? "ja" : "nein"}${vipHint}`,
    "",
    body,
  ].join("\n");

  try {
    const ai = await runMailAi(user, "prioritize_mail", prompt);
    const parsed = parseMailPriorityResponse(ai.text);
    if (!parsed) return null;
    return { ...parsed, modelProvider: ai.provider, modelName: ai.model };
  } catch {
    return null;
  }
}
